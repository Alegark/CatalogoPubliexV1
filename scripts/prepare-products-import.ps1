param(
  [string]$WorkbookPath = "Excel_de_datos\plantilla-productos-publiex-rellena.xlsx",
  [string]$CorrectedWorkbookPath = "Excel_de_datos\plantilla-productos-publiex-rellena-corregida.xlsx",
  [string]$JsonPath = "tmp\catalogo-import.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$root = (Get-Location).Path
$sourcePath = [IO.Path]::GetFullPath((Join-Path $root $WorkbookPath))
$correctedPath = [IO.Path]::GetFullPath((Join-Path $root $CorrectedWorkbookPath))
$jsonOutputPath = [IO.Path]::GetFullPath((Join-Path $root $JsonPath))

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "No se encontró el Excel: $sourcePath"
}

$correctedDirectory = Split-Path -Parent $correctedPath
$jsonDirectory = Split-Path -Parent $jsonOutputPath
New-Item -ItemType Directory -Force -Path $correctedDirectory, $jsonDirectory | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination $correctedPath -Force

function Read-ZipEntryText([IO.Compression.ZipArchive]$Zip, [string]$Name) {
  $entry = $Zip.GetEntry($Name)
  if ($null -eq $entry) { throw "No se encontró la entrada $Name dentro del Excel." }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Write-ZipEntryText([IO.Compression.ZipArchive]$Zip, [string]$Name, [string]$Text) {
  $oldEntry = $Zip.GetEntry($Name)
  if ($null -ne $oldEntry) { $oldEntry.Delete() }
  $newEntry = $Zip.CreateEntry($Name, [IO.Compression.CompressionLevel]::Optimal)
  $writer = [IO.StreamWriter]::new($newEntry.Open(), [Text.UTF8Encoding]::new($false))
  try { $writer.Write($Text) } finally { $writer.Dispose() }
}

function New-XmlNamespaceManager([xml]$Document) {
  $manager = [Xml.XmlNamespaceManager]::new($Document.NameTable)
  $manager.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  return $manager
}

function Get-WorksheetRows([string]$XmlText) {
  $document = [xml]$XmlText
  $manager = New-XmlNamespaceManager $document
  return $document.DocumentElement.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")
}

function Get-CellValue([Xml.XmlElement]$Cell, [string[]]$SharedStrings) {
  $type = $Cell.GetAttribute("t")
  if ($type -eq "inlineStr") {
    return $Cell.SelectSingleNode(".//*[local-name()='t']").InnerText
  }

  $valueNode = $Cell.SelectSingleNode("*[local-name()='v']")
  if ($null -eq $valueNode) { return "" }
  if ($type -eq "s") { return $SharedStrings[[int]$valueNode.InnerText] }
  return $valueNode.InnerText
}

function Get-RowValues([Xml.XmlElement]$Row, [string[]]$SharedStrings) {
  $values = @{}
  foreach ($cell in $Row.SelectNodes("*[local-name()='c']")) {
    $reference = $cell.GetAttribute("r")
    $column = [Regex]::Match($reference, "^[A-Z]+").Value
    $values[$column] = Get-CellValue $cell $SharedStrings
  }
  return $values
}

function Convert-InvariantNumber([string]$Value, [string]$Field) {
  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Field está vacío." }
  return [double]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture)
}

$zip = [IO.Compression.ZipFile]::Open($correctedPath, [IO.Compression.ZipArchiveMode]::Update)
try {
  $sharedStringsXml = Read-ZipEntryText $zip "xl/sharedStrings.xml"
  $correctedSharedStringsXml = $sharedStringsXml
  if ([Regex]::Matches($correctedSharedStringsXml, "<t>30\.x40x15cm</t>").Count -ne 1) {
    throw "No se encontró exactamente una celda con la medida 30.x40x15cm."
  }
  if ([Regex]::Matches($correctedSharedStringsXml, "<t>30z30cm</t>").Count -ne 1) {
    throw "No se encontró exactamente una celda con la medida 30z30cm."
  }
  $correctedSharedStringsXml = $correctedSharedStringsXml.Replace("<t>30.x40x15cm</t>", "<t>30x40x15cm</t>")
  $correctedSharedStringsXml = $correctedSharedStringsXml.Replace("<t>30z30cm</t>", "<t>30x30cm</t>")
  Write-ZipEntryText $zip "xl/sharedStrings.xml" $correctedSharedStringsXml
}
finally {
  $zip.Dispose()
}

$zip = [IO.Compression.ZipFile]::OpenRead($correctedPath)
try {
  $sharedDocument = [xml](Read-ZipEntryText $zip "xl/sharedStrings.xml")
  $sharedManager = New-XmlNamespaceManager $sharedDocument
    $sharedStrings = @($sharedDocument.DocumentElement.SelectNodes("//*[local-name()='si']") | ForEach-Object { $_.InnerText })

  function Read-Sheet($SheetName) {
    $sheetXml = Read-ZipEntryText $zip $SheetName
    $document = [xml]$sheetXml
    $manager = New-XmlNamespaceManager $document
    return @($document.DocumentElement.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']") | ForEach-Object {
      [pscustomobject]@{
        Number = [int]$_.GetAttribute("r")
        Values = Get-RowValues $_ $sharedStrings
      }
    })
  }

  $productRows = Read-Sheet "xl/worksheets/sheet3.xml"
  $variantRows = Read-Sheet "xl/worksheets/sheet4.xml"
  $offerRows = Read-Sheet "xl/worksheets/sheet5.xml"

  $products = @(
    foreach ($row in $productRows | Where-Object Number -ge 5) {
      $v = $row.Values
      if ([string]::IsNullOrWhiteSpace($v["A"])) { continue }
      [ordered]@{
        slug = $v["A"].Trim()
        name = $v["B"].Trim()
        category = $v["C"].Trim()
        description = $v["D"].Trim()
        basePrice = Convert-InvariantNumber $v["E"] "precio base de $($v['A'])"
        deliveryTime = $v["F"].Trim()
      }
    }
  )

  $variants = @(
    foreach ($row in $variantRows | Where-Object Number -ge 5) {
      $v = $row.Values
      if ([string]::IsNullOrWhiteSpace($v["A"])) { continue }
      [ordered]@{
        productSlug = $v["A"].Trim()
        name = $v["B"].Trim()
        price = Convert-InvariantNumber $v["C"] "precio de variante en fila $($row.Number)"
      }
    }
  )

  $offers = @(
    foreach ($row in $offerRows | Where-Object Number -ge 5) {
      $v = $row.Values
      if ([string]::IsNullOrWhiteSpace($v["A"])) { continue }
      [ordered]@{
        productSlug = $v["A"].Trim()
        threshold = [int](Convert-InvariantNumber $v["B"] "umbral de oferta en fila $($row.Number)")
        percent = Convert-InvariantNumber $v["C"] "porcentaje de oferta en fila $($row.Number)"
      }
    }
  )
}
finally {
  $zip.Dispose()
}

$slugs = [Collections.Generic.HashSet[string]]::new()
foreach ($product in $products) {
  if (-not $slugs.Add($product.slug)) { throw "Slug duplicado: $($product.slug)" }
  if ($product.basePrice -le 0) { throw "El precio base de $($product.slug) debe ser mayor que 0." }
}
foreach ($variant in $variants) {
  if (-not $slugs.Contains($variant.productSlug)) { throw "Variante sin producto: $($variant.productSlug)" }
  if ($variant.price -lt 0) { throw "Precio de variante negativo en $($variant.productSlug)." }
}
foreach ($offer in $offers) {
  if (-not $slugs.Contains($offer.productSlug)) { throw "Oferta sin producto: $($offer.productSlug)" }
}

$payload = [ordered]@{
  products = $products
  variants = $variants
  offers = $offers
  images = @()
}
$jsonText = $payload | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($jsonOutputPath, $jsonText, [Text.UTF8Encoding]::new($false))

Write-Output "Excel corregido: $correctedPath"
Write-Output "Importación preparada: $jsonOutputPath"
Write-Output "Productos: $($products.Count) | Variantes: $($variants.Count) | Ofertas: $($offers.Count)"
Write-Output "Variante gratuita detectada: $((@($variants | Where-Object price -eq 0)).Count)"
