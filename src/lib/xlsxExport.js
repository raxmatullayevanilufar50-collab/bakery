// xlsx faqat Excel eksport tugmasi bosilganda yuklanadi (dynamic import) —
// kutubxona ancha og'ir, uni faqat shu funksiyani ishlatadigan Owner
// yuklashi kerak, asosiy bundle'ga kirmasin.
export async function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
