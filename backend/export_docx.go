package backend

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
)

// generateDocx creates a minimal valid .docx file in memory.
// title is the document heading; headers are column headers; rows are data rows.
func generateDocx(title string, headers []string, rows [][]string) ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// [Content_Types].xml
	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
		`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
		`<Default Extension="xml" ContentType="application/xml"/>` +
		`<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
		`</Types>`
	f, _ := w.Create("[Content_Types].xml")
	f.Write([]byte(contentTypes))

	// _rels/.rels
	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
		`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
		`</Relationships>`
	f, _ = w.Create("_rels/.rels")
	f.Write([]byte(rels))

	// word/_rels/document.xml.rels
	docRels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
	f, _ = w.Create("word/_rels/document.xml.rels")
	f.Write([]byte(docRels))

	// word/document.xml
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`)
	sb.WriteString(`<w:body>`)

	// Title paragraph
	sb.WriteString(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>`)
	sb.WriteString(`<w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>`)
	sb.WriteString(docxEscape(title))
	sb.WriteString(`</w:t></w:r></w:p>`)

	// Table
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

	// Header row
	sb.WriteString(`<w:tr>`)
	for _, h := range headers {
		sb.WriteString(`<w:tc>`)
		sb.WriteString(`<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>`)
		sb.WriteString(`<w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr>`)
		sb.WriteString(`<w:t xml:space="preserve">`)
		sb.WriteString(docxEscape(h))
		sb.WriteString(`</w:t></w:r></w:p></w:tc>`)
	}
	sb.WriteString(`</w:tr>`)

	// Data rows
	for i, row := range rows {
		sb.WriteString(`<w:tr>`)
		fillColor := "FFFFFF"
		if i%2 == 1 {
			fillColor = "DCE6F1"
		}
		for _, cell := range row {
			sb.WriteString(`<w:tc>`)
			sb.WriteString(fmt.Sprintf(`<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="%s"/></w:tcPr>`, fillColor))
			sb.WriteString(`<w:p><w:r><w:rPr><w:sz w:val="16"/></w:rPr>`)
			sb.WriteString(`<w:t xml:space="preserve">`)
			sb.WriteString(docxEscape(cell))
			sb.WriteString(`</w:t></w:r></w:p></w:tc>`)
		}
		sb.WriteString(`</w:tr>`)
	}

	sb.WriteString(`</w:tbl>`)
	sb.WriteString(`<w:sectPr><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`)
	sb.WriteString(`</w:body></w:document>`)

	f, _ = w.Create("word/document.xml")
	f.Write([]byte(sb.String()))

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close docx zip: %w", err)
	}
	return buf.Bytes(), nil
}

func docxEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}
