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
	Subtitle         string
	Details          []printableExportField
	TableTitle       string
	TableNote        string
	Headers          []string
	Rows             [][]string
	Footer           []printableExportField
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
	generatedAt := doc.GeneratedAt
	if generatedAt.IsZero() {
		generatedAt = time.Now()
	}

	rows := [][]string{{doc.Title}}
	if strings.TrimSpace(doc.Subtitle) != "" {
		rows = append(rows, []string{doc.Subtitle})
	}
	rows = append(rows, []string{fmt.Sprintf("Generated: %s", generatedAt.Format("January 02, 2006 3:04 PM"))})

	if len(doc.Details) > 0 {
		// Match UI section label used in on-screen views
		rows = append(rows, []string{""}, []string{"CLASS INFORMATION"})
		for _, field := range doc.Details {
			rows = append(rows, []string{field.Label, field.Value})
		}
	}

	rows = append(rows, []string{""}, []string{doc.TableTitle})
	if strings.TrimSpace(doc.TableNote) != "" {
		rows = append(rows, []string{doc.TableNote})
	}
	rows = append(rows, doc.Headers)
	rows = append(rows, doc.Rows...)

	if len(doc.Footer) > 0 {
		rows = append(rows, []string{""}, []string{"SUMMARY"})
		for _, field := range doc.Footer {
			rows = append(rows, []string{field.Label, field.Value})
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
	pdf.Cell(0, 8, doc.Title)
	pdf.Ln(9)

	if strings.TrimSpace(doc.Subtitle) != "" {
		pdf.SetFont("Arial", "", 11)
		pdf.Cell(0, 6, doc.Subtitle)
		pdf.Ln(7)
	}

	generatedAt := doc.GeneratedAt
	if generatedAt.IsZero() {
		generatedAt = time.Now()
	}

	if len(doc.Details) > 0 {
		pdf.SetFont("Arial", "B", 10)
		// Match UI section label used in on-screen views
		pdf.Cell(0, 6, "CLASS INFORMATION")
		pdf.Ln(7)

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
			pdf.CellFormat(valueWidth, 6, pdfCellValue(left.Value, int(valueWidth*2.2)), "", 0, "L", false, 0, "")

			if i+1 < len(doc.Details) {
				right := doc.Details[i+1]
				pdf.SetFont("Arial", "B", 9)
				pdf.CellFormat(labelWidth, 6, right.Label+":", "", 0, "L", false, 0, "")
				pdf.SetFont("Arial", "", 9)
				pdf.CellFormat(valueWidth, 6, pdfCellValue(right.Value, int(valueWidth*2.2)), "", 0, "L", false, 0, "")
			} else {
				pdf.CellFormat(pairWidth, 6, "", "", 0, "L", false, 0, "")
			}

			pdf.Ln(6)
		}

		pdf.Ln(3)
	}

	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(0, 6, doc.TableTitle, "", 1, "L", false, 0, "")
	if strings.TrimSpace(doc.TableNote) != "" {
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, doc.TableNote, "", 1, "L", false, 0, "")
		pdf.Ln(2)
	} else {
		pdf.Ln(2)
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
			maxChars := int(widths[index] * 2.2)
			// Plain rows: no alternating background colors
			pdf.CellFormat(widths[index], 6, pdfCellValue(cell, maxChars), "1", 0, align, false, 0, "")
		}
		pdf.Ln(-1)
	}

	if len(doc.Footer) > 0 {
		pdf.Ln(4)
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(0, 6, "SUMMARY")
		pdf.Ln(7)
		pdf.SetFont("Arial", "", 9)
		for _, field := range doc.Footer {
			pdf.SetFont("Arial", "B", 9)
			pdf.CellFormat(35, 6, field.Label+":", "", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 9)
			pdf.CellFormat(0, 6, field.Value, "", 1, "L", false, 0, "")
		}
	}

	// Generated timestamp at the bottom of the content
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(0, 4, fmt.Sprintf("Generated: %s", generatedAt.Format("January 02, 2006 3:04 PM")), "", 0, "R", false, 0, "")

	return pdf.OutputFileAndClose(filename)
}

func generatePrintableDocx(doc printableExportDocument) ([]byte, error) {
	generatedAt := doc.GeneratedAt
	if generatedAt.IsZero() {
		generatedAt = time.Now()
	}

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

	sb.WriteString(docxParagraph(doc.Title, true, 32, true))
	if strings.TrimSpace(doc.Subtitle) != "" {
		sb.WriteString(docxParagraph(doc.Subtitle, false, 22, true))
	}

	if len(doc.Details) > 0 {
		// Match UI section label used in on-screen views
		sb.WriteString(docxParagraph("CLASS INFORMATION", true, 22, false))
		for _, field := range doc.Details {
			sb.WriteString(docxParagraph(fmt.Sprintf("%s: %s", field.Label, field.Value), false, 18, false))
		}
	}

	sb.WriteString(docxParagraph(doc.TableTitle, true, 22, false))
	if strings.TrimSpace(doc.TableNote) != "" {
		sb.WriteString(docxParagraph(doc.TableNote, false, 18, false))
	}

	sb.WriteString(`<w:tbl>`)
	sb.WriteString(`<w:tblPr>`)
	sb.WriteString(`<w:tblW w:w="9360" w:type="dxa"/>`)
	sb.WriteString(`<w:tblBorders>`)
	sb.WriteString(`<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`</w:tblBorders>`)
	sb.WriteString(`</w:tblPr>`)

	sb.WriteString(`<w:tr>`)
	for _, header := range doc.Headers {
		sb.WriteString(docxTableCell(header, "1F3864", true, true))
	}
	sb.WriteString(`</w:tr>`)

	for rowIndex, row := range doc.Rows {
		fillColor := "FFFFFF"
		if rowIndex%2 == 1 {
			fillColor = "DCE6F1"
		}
		sb.WriteString(`<w:tr>`)
		for index := range doc.Headers {
			cell := ""
			if index < len(row) {
				cell = row[index]
			}
			sb.WriteString(docxTableCell(cell, fillColor, false, false))
		}
		sb.WriteString(`</w:tr>`)
	}

	sb.WriteString(`</w:tbl>`)

	if len(doc.Footer) > 0 {
		sb.WriteString(docxParagraph("SUMMARY", true, 22, false))
		for _, field := range doc.Footer {
			sb.WriteString(docxParagraph(fmt.Sprintf("%s: %s", field.Label, field.Value), false, 18, false))
		}
	}

	// Generated timestamp near the bottom of the document
	sb.WriteString(docxParagraph(fmt.Sprintf("Generated: %s", generatedAt.Format("January 02, 2006 3:04 PM")), false, 16, false))

	sb.WriteString(`<w:sectPr><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`)
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
		return "N/A"
	}
	if maxChars <= 3 {
		return trimmed
	}
	return truncateString(trimmed, maxChars)
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

func docxTableCell(text, fillColor string, bold bool, whiteText bool) string {
	var sb strings.Builder
	sb.WriteString(`<w:tc><w:tcPr>`)
	// Plain cell: no background color shading
	sb.WriteString(`<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>`)
	sb.WriteString(`</w:tcPr><w:p><w:r><w:rPr>`)
	if bold {
		sb.WriteString(`<w:b/>`)
	}
	// Always use default text color (no explicit color)
	sb.WriteString(`<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">`)
	sb.WriteString(docxEscape(strings.TrimSpace(text)))
	sb.WriteString(`</w:t></w:r></w:p></w:tc>`)
	return sb.String()
}
