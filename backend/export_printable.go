package backend

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

type printableExportField struct {
	Label string
	Value string
}

type printableExportDocument struct {
	Title            string
	TitleCentered    bool
	Subtitle         string
	SubtitleCentered bool
	DetailsTitle     string
	Details          []printableExportField
	TableTitle       string
	TableRightNote   string
	TableNote        string
	Headers          []string
	Rows             [][]string
	Footer           []printableExportField
	FooterInline     bool
	ColumnWidths     []float64
	ColumnAlignments []string
	Orientation      string
	GeneratedAt      time.Time
}

func writePrintableCSV(filename string, doc printableExportDocument) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	for _, row := range buildPrintableCSVRows(doc) {
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return err
	}

	return nil
}

func buildPrintableCSVRows(doc printableExportDocument) [][]string {
	rows := [][]string{{doc.Title}}
	if strings.TrimSpace(doc.Subtitle) != "" {
		rows = append(rows, []string{doc.Subtitle})
	}

	if strings.TrimSpace(doc.DetailsTitle) != "" {
		rows = append(rows, []string{""})
		rows = append(rows, []string{doc.DetailsTitle})
	}

	if len(doc.Details) > 0 {
		rows = append(rows, []string{""})
		for _, field := range doc.Details {
			rows = append(rows, []string{field.Label, field.Value})
		}
	}

	rows = append(rows, []string{""})
	if strings.TrimSpace(doc.TableTitle) != "" || strings.TrimSpace(doc.TableRightNote) != "" {
		rows = append(rows, []string{doc.TableTitle, doc.TableRightNote})
	}
	if strings.TrimSpace(doc.TableNote) != "" {
		rows = append(rows, []string{doc.TableNote})
	}
	rows = append(rows, doc.Headers)
	rows = append(rows, doc.Rows...)

	if len(doc.Footer) > 0 {
		rows = append(rows, []string{""})
		if doc.FooterInline {
			summary := make([]string, 0, len(doc.Footer))
			for _, field := range doc.Footer {
				summary = append(summary, fmt.Sprintf("%s: %s", field.Label, field.Value))
			}
			rows = append(rows, summary)
		} else {
			for _, field := range doc.Footer {
				rows = append(rows, []string{field.Label, field.Value})
			}
		}
	}

	return rows
}

func writePrintablePDF(filename string, doc printableExportDocument) error {
	orientation := strings.ToUpper(strings.TrimSpace(doc.Orientation))
	if orientation != "L" {
		orientation = "P"
	}

	pdf := gofpdf.New(orientation, "mm", "A4", "")
	pdf.SetMargins(10, 12, 10)
	pdf.SetAutoPageBreak(true, 12)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 16)
	if doc.TitleCentered {
		pdf.CellFormat(0, 8, doc.Title, "", 1, "C", false, 0, "")
		pdf.Ln(1)
	} else {
		pdf.Cell(0, 8, doc.Title)
		pdf.Ln(9)
	}

	if strings.TrimSpace(doc.Subtitle) != "" {
		pdf.SetFont("Arial", "", 11)
		if doc.SubtitleCentered {
			pdf.CellFormat(0, 6, doc.Subtitle, "", 1, "C", false, 0, "")
			pdf.Ln(1)
		} else {
			pdf.Cell(0, 6, doc.Subtitle)
			pdf.Ln(7)
		}
	}

	if strings.TrimSpace(doc.DetailsTitle) != "" {
		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(0, 7, doc.DetailsTitle, "1", 1, "L", false, 0, "")
	}

	if len(doc.Details) > 0 {
		pdf.SetFont("Arial", "", 9)
		pageWidth, _ := pdf.GetPageSize()
		usableWidth := pageWidth - 20
		labelWidth := usableWidth * 0.22
		valueWidth := usableWidth * 0.28
		pairWidth := labelWidth + valueWidth

		for i := 0; i < len(doc.Details); i += 2 {
			left := doc.Details[i]
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(labelWidth, 6, left.Label+":", "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(valueWidth, 6, pdfCellValueForWidth(left.Value, pdf, valueWidth), "", 0, "L", false, 0, "")

			if i+1 < len(doc.Details) {
				right := doc.Details[i+1]
				pdf.SetFont("Arial", "B", 9)
				pdf.CellFormat(labelWidth, 6, right.Label+":", "", 0, "L", false, 0, "")
				pdf.SetFont("Arial", "", 9)
				pdf.CellFormat(valueWidth, 6, pdfCellValueForWidth(right.Value, pdf, valueWidth), "", 0, "L", false, 0, "")
			} else {
				pdf.CellFormat(pairWidth, 6, "", "", 0, "L", false, 0, "")
			}

			pdf.Ln(6)
		}

		pdf.Ln(3)
	}

	if strings.TrimSpace(doc.TableNote) != "" {
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, doc.TableNote, "", 1, "L", false, 0, "")
		pdf.Ln(2)
	} else {
		pdf.Ln(2)
	}

	if strings.TrimSpace(doc.TableTitle) != "" || strings.TrimSpace(doc.TableRightNote) != "" {
		pageWidth, _ := pdf.GetPageSize()
		usableWidth := pageWidth - 20
		leftWidth := usableWidth * 0.72
		rightWidth := usableWidth - leftWidth

		pdf.SetFont("Arial", "B", 10)
		pdf.CellFormat(leftWidth, 7, doc.TableTitle, "1", 0, "L", false, 0, "")
		pdf.CellFormat(rightWidth, 7, doc.TableRightNote, "1", 1, "R", false, 0, "")
	}

	widths := resolvePrintableColumnWidths(doc, pdf)
	alignments := resolvePrintableAlignments(doc)
	drawTableHeader := func() {
		pdf.SetFont("Arial", "B", 9)
		// Plain header: no background color, default text color
		for index, header := range doc.Headers {
			align := alignments[index]
			pdf.CellFormat(widths[index], 7, header, "1", 0, align, false, 0, "")
		}
		pdf.Ln(-1)
	}

	drawTableHeader()
	pdf.SetFont("Arial", "", 8)
	_, pageHeight := pdf.GetPageSize()
	for _, row := range doc.Rows {
		if pdf.GetY()+7 > pageHeight-12 {
			pdf.AddPage()
			drawTableHeader()
			pdf.SetFont("Arial", "", 8)
		}

		for index := range doc.Headers {
			cell := ""
			if index < len(row) {
				cell = row[index]
			}
			align := alignments[index]
			// Plain rows: no alternating background colors
			pdf.CellFormat(widths[index], 6, pdfCellValueForWidth(cell, pdf, widths[index]), "1", 0, align, false, 0, "")
		}
		pdf.Ln(-1)
	}

	if len(doc.Footer) > 0 {
		pdf.Ln(4)
		if doc.FooterInline {
			pageWidth, _ := pdf.GetPageSize()
			usableWidth := pageWidth - 20
			cellWidth := usableWidth / float64(len(doc.Footer))

			pdf.SetFont("Arial", "B", 9)
			for _, field := range doc.Footer {
				value := fmt.Sprintf("%s: %s", field.Label, field.Value)
				pdf.CellFormat(cellWidth, 7, pdfCellValueForWidth(value, pdf, cellWidth), "1", 0, "L", false, 0, "")
			}
			pdf.Ln(-1)
		} else {
			pdf.SetFont("Arial", "", 9)
			for _, field := range doc.Footer {
				pdf.SetFont("Arial", "B", 9)
				pdf.CellFormat(35, 6, field.Label+":", "", 0, "L", false, 0, "")
				pdf.SetFont("Arial", "", 9)
				pdf.CellFormat(0, 6, field.Value, "", 1, "L", false, 0, "")
			}
		}
	}

	return pdf.OutputFileAndClose(filename)
}

func generatePrintableDocx(doc printableExportDocument) ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
		`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
		`<Default Extension="xml" ContentType="application/xml"/>` +
		`<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
		`</Types>`
	f, err := w.Create("[Content_Types].xml")
	if err != nil {
		return nil, fmt.Errorf("failed to create content types: %w", err)
	}
	if _, err := f.Write([]byte(contentTypes)); err != nil {
		return nil, fmt.Errorf("failed to write content types: %w", err)
	}

	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
		`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
		`</Relationships>`
	f, err = w.Create("_rels/.rels")
	if err != nil {
		return nil, fmt.Errorf("failed to create root rels: %w", err)
	}
	if _, err := f.Write([]byte(rels)); err != nil {
		return nil, fmt.Errorf("failed to write root rels: %w", err)
	}

	docRels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
	f, err = w.Create("word/_rels/document.xml.rels")
	if err != nil {
		return nil, fmt.Errorf("failed to create document rels: %w", err)
	}
	if _, err := f.Write([]byte(docRels)); err != nil {
		return nil, fmt.Errorf("failed to write document rels: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`)
	sb.WriteString(`<w:body>`)

	sb.WriteString(docxParagraph(doc.Title, true, 32, doc.TitleCentered))
	if strings.TrimSpace(doc.Subtitle) != "" {
		sb.WriteString(docxParagraph(doc.Subtitle, false, 22, doc.SubtitleCentered))
	}

	if strings.TrimSpace(doc.DetailsTitle) != "" {
		sb.WriteString(docxParagraph(doc.DetailsTitle, true, 22, false))
	}

	if len(doc.Details) > 0 {
		sb.WriteString(buildDocxDetailsTable(doc.Details))
	}

	if strings.TrimSpace(doc.TableNote) != "" {
		sb.WriteString(docxParagraph(doc.TableNote, false, 18, false))
	}

	if strings.TrimSpace(doc.TableTitle) != "" || strings.TrimSpace(doc.TableRightNote) != "" {
		sb.WriteString(buildDocxSectionHeaderTable(doc.TableTitle, doc.TableRightNote))
	}

	const tableWidthTwips = 9360
	columnWidths := resolvePrintableDocxColumnWidthsTwips(doc, tableWidthTwips)
	columnCharLimits := resolvePrintableDocxColumnCharLimits(columnWidths)
	alignments := resolvePrintableAlignments(doc)

	// DOCX table: font size 16 (8pt), reduced spacing for PDF-like density
	sb.WriteString(`<w:tbl>`)
	sb.WriteString(`<w:tblPr>`)
	sb.WriteString(fmt.Sprintf(`<w:tblW w:w="%d" w:type="dxa"/>`, tableWidthTwips))
	sb.WriteString(`<w:tblBorders>`)
	sb.WriteString(`<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`</w:tblBorders>`)
	sb.WriteString(`</w:tblPr>`)
	sb.WriteString(`<w:tblGrid>`)
	for _, width := range columnWidths {
		sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, width))
	}
	sb.WriteString(`</w:tblGrid>`)

	// Header row
	sb.WriteString(`<w:tr>`)
	for index, header := range doc.Headers {
		sb.WriteString(docxTableCellWithFont(header, true, alignments[index], columnWidths[index], columnCharLimits[index], 16, 0))
	}
	sb.WriteString(`</w:tr>`)

	// Data rows
	for _, row := range doc.Rows {
		sb.WriteString(`<w:tr>`)
		for index := range doc.Headers {
			cell := ""
			if index < len(row) {
				cell = row[index]
			}
			sb.WriteString(docxTableCellWithFont(cell, false, alignments[index], columnWidths[index], columnCharLimits[index], 16, 0))
		}
		sb.WriteString(`</w:tr>`)
	}

	sb.WriteString(`</w:tbl>`)

	if len(doc.Footer) > 0 {
		if doc.FooterInline {
			parts := make([]string, 0, len(doc.Footer))
			for _, field := range doc.Footer {
				parts = append(parts, fmt.Sprintf("%s: %s", field.Label, field.Value))
			}
			sb.WriteString(docxParagraph(strings.Join(parts, "    "), true, 18, false))
		} else {
			for _, field := range doc.Footer {
				sb.WriteString(docxParagraph(fmt.Sprintf("%s: %s", field.Label, field.Value), false, 18, false))
			}
		}
	}

	orientation := strings.ToUpper(strings.TrimSpace(doc.Orientation))
	if orientation == "L" {
		sb.WriteString(`<w:sectPr><w:pgSz w:w="16840" w:h="11900" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`)
	} else {
		sb.WriteString(`<w:sectPr><w:pgSz w:w="11900" w:h="16840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`)
	}
	sb.WriteString(`</w:body></w:document>`)

	f, err = w.Create("word/document.xml")
	if err != nil {
		return nil, fmt.Errorf("failed to create document.xml: %w", err)
	}
	if _, err := f.Write([]byte(sb.String())); err != nil {
		return nil, fmt.Errorf("failed to write document.xml: %w", err)
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close docx zip: %w", err)
	}

	return buf.Bytes(), nil
}

func resolvePrintableColumnWidths(doc printableExportDocument, pdf *gofpdf.Fpdf) []float64 {
	pageWidth, _ := pdf.GetPageSize()
	usableWidth := pageWidth - 20
	widths := make([]float64, len(doc.Headers))

	if len(doc.ColumnWidths) == len(doc.Headers) {
		var total float64
		for _, width := range doc.ColumnWidths {
			total += width
		}
		if total > 0 {
			scale := usableWidth / total
			for index, width := range doc.ColumnWidths {
				widths[index] = width * scale
			}
			return widths
		}
	}

	defaultWidth := usableWidth / float64(len(doc.Headers))
	for index := range widths {
		widths[index] = defaultWidth
	}
	return widths
}

func resolvePrintableAlignments(doc printableExportDocument) []string {
	alignments := make([]string, len(doc.Headers))
	for index := range alignments {
		alignments[index] = "L"
	}

	if len(doc.ColumnAlignments) == len(doc.Headers) {
		copy(alignments, doc.ColumnAlignments)
	}

	return alignments
}

func pdfCellValue(value string, maxChars int) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if maxChars <= 3 {
		return trimmed
	}
	return truncateString(trimmed, maxChars)
}

func pdfCellValueForWidth(value string, pdf *gofpdf.Fpdf, width float64) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || pdf == nil {
		return trimmed
	}

	normalized := strings.Join(strings.Fields(trimmed), " ")
	if normalized == "" {
		return ""
	}

	availableWidth := width - 1.5
	if availableWidth <= 0 {
		return normalized
	}

	if pdf.GetStringWidth(normalized) <= availableWidth {
		return normalized
	}

	const ellipsis = "..."
	ellipsisWidth := pdf.GetStringWidth(ellipsis)
	if ellipsisWidth >= availableWidth {
		return ""
	}

	runes := []rune(normalized)
	var builder strings.Builder
	for _, r := range runes {
		candidate := builder.String() + string(r)
		if pdf.GetStringWidth(strings.TrimRight(candidate, " "))+ellipsisWidth > availableWidth {
			break
		}
		builder.WriteRune(r)
	}

	result := strings.TrimSpace(builder.String())
	if result == "" {
		return ellipsis
	}

	return result + ellipsis
}

func docxEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

func docxParagraph(text string, bold bool, size int, centered bool) string {
	var sb strings.Builder
	sb.WriteString(`<w:p><w:pPr>`)
	if centered {
		sb.WriteString(`<w:jc w:val="center"/>`)
	}
	sb.WriteString(`<w:spacing w:after="120"/></w:pPr><w:r><w:rPr>`)
	if bold {
		sb.WriteString(`<w:b/>`)
	}
	sb.WriteString(fmt.Sprintf(`<w:sz w:val="%d"/>`, size))
	sb.WriteString(`</w:rPr><w:t xml:space="preserve">`)
	sb.WriteString(docxEscape(text))
	sb.WriteString(`</w:t></w:r></w:p>`)
	return sb.String()
}

// docxTableCellWithFont: like docxTableCell, but allows font size and spacing control
func docxTableCellWithFont(text string, bold bool, align string, widthTwips int, maxChars int, fontSz int, spacing int) string {
	var sb strings.Builder
	sb.WriteString(`<w:tc><w:tcPr>`)
	sb.WriteString(fmt.Sprintf(`<w:tcW w:w="%d" w:type="dxa"/>`, widthTwips))
	sb.WriteString(`</w:tcPr><w:p><w:pPr>`)
	sb.WriteString(fmt.Sprintf(`<w:jc w:val="%s"/>`, docxAlignment(align)))
	if spacing > 0 {
		sb.WriteString(fmt.Sprintf(`<w:spacing w:after="%d"/>`, spacing))
	} else {
		sb.WriteString(`<w:spacing w:after="0"/>`)
	}
	sb.WriteString(`</w:pPr><w:r><w:rPr>`)
	if bold {
		sb.WriteString(`<w:b/>`)
	}
	sb.WriteString(fmt.Sprintf(`<w:sz w:val="%d"/>`, fontSz))
	sb.WriteString(`</w:rPr><w:t xml:space="preserve">`)
	sb.WriteString(docxEscape(pdfCellValue(text, maxChars)))
	sb.WriteString(`</w:t></w:r></w:p></w:tc>`)
	return sb.String()
}

func docxAlignment(align string) string {
	switch strings.ToUpper(strings.TrimSpace(align)) {
	case "C":
		return "center"
	case "R":
		return "right"
	default:
		return "left"
	}
}

func resolvePrintableDocxColumnWidthsTwips(doc printableExportDocument, tableWidthTwips int) []int {
	columnCount := len(doc.Headers)
	widths := make([]int, columnCount)
	if columnCount == 0 {
		return widths
	}

	if len(doc.ColumnWidths) == columnCount {
		var total float64
		for _, width := range doc.ColumnWidths {
			total += width
		}
		if total > 0 {
			remaining := tableWidthTwips
			for i, width := range doc.ColumnWidths {
				computed := int((width / total) * float64(tableWidthTwips))
				if computed < 1 {
					computed = 1
				}
				widths[i] = computed
				remaining -= computed
			}
			if remaining != 0 {
				widths[columnCount-1] += remaining
			}
			return widths
		}
	}

	defaultWidth := tableWidthTwips / columnCount
	for i := range widths {
		widths[i] = defaultWidth
	}
	widths[columnCount-1] += tableWidthTwips - (defaultWidth * columnCount)
	return widths
}

func resolvePrintableDocxColumnCharLimits(widths []int) []int {
	limits := make([]int, len(widths))
	if len(widths) == 0 {
		return limits
	}

	total := 0
	for _, width := range widths {
		total += width
	}
	if total <= 0 {
		for i := range limits {
			limits[i] = 32
		}
		return limits
	}

	const totalChars = 160
	for i, width := range widths {
		chars := int((float64(width) / float64(total)) * totalChars)
		if chars < 4 {
			chars = 4
		}
		limits[i] = chars
	}

	return limits
}

func buildDocxDetailsTable(details []printableExportField) string {
	if len(details) == 0 {
		return ""
	}

	const tableWidthTwips = 9360
	pairWidth := tableWidthTwips / 2
	leftLabelWidth := int(float64(pairWidth) * 0.44)
	leftValueWidth := pairWidth - leftLabelWidth
	rightLabelWidth := leftLabelWidth
	rightValueWidth := pairWidth - rightLabelWidth

	leftLabelChars := max(8, leftLabelWidth/120)
	leftValueChars := max(12, leftValueWidth/80)
	rightLabelChars := max(8, rightLabelWidth/120)
	rightValueChars := max(12, rightValueWidth/80)

	var sb strings.Builder
	sb.WriteString(`<w:tbl>`)
	sb.WriteString(`<w:tblPr>`)
	sb.WriteString(fmt.Sprintf(`<w:tblW w:w="%d" w:type="dxa"/>`, tableWidthTwips))
	sb.WriteString(`<w:tblBorders>`)
	sb.WriteString(`<w:top w:val="nil"/>`)
	sb.WriteString(`<w:left w:val="nil"/>`)
	sb.WriteString(`<w:bottom w:val="nil"/>`)
	sb.WriteString(`<w:right w:val="nil"/>`)
	sb.WriteString(`<w:insideH w:val="nil"/>`)
	sb.WriteString(`<w:insideV w:val="nil"/>`)
	sb.WriteString(`</w:tblBorders>`)
	sb.WriteString(`</w:tblPr>`)
	sb.WriteString(`<w:tblGrid>`)
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, leftLabelWidth))
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, leftValueWidth))
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, rightLabelWidth))
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, rightValueWidth))
	sb.WriteString(`</w:tblGrid>`)

	for i := 0; i < len(details); i += 2 {
		left := details[i]

		rightLabel := ""
		rightValue := ""
		if i+1 < len(details) {
			right := details[i+1]
			rightLabel = right.Label
			rightValue = right.Value
		}

		sb.WriteString(`<w:tr>`)
		sb.WriteString(docxDetailsCellWithFont(strings.TrimSpace(left.Label)+":", true, leftLabelWidth, leftLabelChars, 16))
		sb.WriteString(docxDetailsCellWithFont(left.Value, false, leftValueWidth, leftValueChars, 16))
		sb.WriteString(docxDetailsCellWithFont(strings.TrimSpace(rightLabel)+":", true, rightLabelWidth, rightLabelChars, 16))
		sb.WriteString(docxDetailsCellWithFont(rightValue, false, rightValueWidth, rightValueChars, 16))
		sb.WriteString(`</w:tr>`)
	}

	sb.WriteString(`</w:tbl>`)
	return sb.String()
}

func buildDocxSectionHeaderTable(left, right string) string {
	tableWidthTwips := 9360
	leftWidth := int(float64(tableWidthTwips) * 0.72)
	rightWidth := tableWidthTwips - leftWidth

	leftChars := max(20, leftWidth/90)
	rightChars := max(12, rightWidth/90)

	var sb strings.Builder
	sb.WriteString(`<w:tbl>`)
	sb.WriteString(`<w:tblPr>`)
	sb.WriteString(fmt.Sprintf(`<w:tblW w:w="%d" w:type="dxa"/>`, tableWidthTwips))
	sb.WriteString(`<w:tblBorders>`)
	sb.WriteString(`<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`</w:tblBorders>`)
	sb.WriteString(`</w:tblPr>`)
	sb.WriteString(`<w:tblGrid>`)
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, leftWidth))
	sb.WriteString(fmt.Sprintf(`<w:gridCol w:w="%d"/>`, rightWidth))
	sb.WriteString(`</w:tblGrid>`)
	sb.WriteString(`<w:tr>`)
	sb.WriteString(docxTableCellWithFont(left, true, "L", leftWidth, leftChars, 18, 0))
	sb.WriteString(docxTableCellWithFont(right, true, "R", rightWidth, rightChars, 18, 0))
	sb.WriteString(`</w:tr>`)
	sb.WriteString(`</w:tbl>`)

	return sb.String()
}

// docxDetailsCellWithFont: like docxDetailsCell, but allows font size
func docxDetailsCellWithFont(text string, bold bool, widthTwips int, maxChars int, fontSz int) string {
	var sb strings.Builder
	sb.WriteString(`<w:tc><w:tcPr>`)
	sb.WriteString(fmt.Sprintf(`<w:tcW w:w="%d" w:type="dxa"/>`, widthTwips))
	sb.WriteString(`</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>`)
	if bold {
		sb.WriteString(`<w:b/>`)
	}
	sb.WriteString(fmt.Sprintf(`<w:sz w:val="%d"/>`, fontSz))
	sb.WriteString(`</w:rPr><w:t xml:space="preserve">`)
	sb.WriteString(docxEscape(pdfCellValue(text, maxChars)))
	sb.WriteString(`</w:t></w:r></w:p></w:tc>`)
	return sb.String()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
