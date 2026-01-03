import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus, ArrowDownTray, PhotoSolid } from "@medusajs/icons"
import { Container, Heading, Text, Button, toast, Toaster, Badge } from "@medusajs/ui"
import { useEffect, useState, useRef, useCallback } from "react"
import { HotTable } from "@handsontable/react"
import { registerAllModules } from "handsontable/registry"
import Handsontable from "handsontable"
import "handsontable/dist/handsontable.full.min.css"

// Register all Handsontable modules
registerAllModules()

// Dark mode styles for Handsontable
const darkModeStyles = `
  /* Dark mode detection and overrides for Handsontable */
  .dark .handsontable,
  [data-theme="dark"] .handsontable,
  :root.dark .handsontable {
    --ht-background: #1f2937;
    --ht-cell-background: #1f2937;
    --ht-border-color: #374151;
    --ht-header-background: #111827;
    --ht-header-text: #f9fafb;
    --ht-cell-text: #f3f4f6;
    --ht-active-background: #374151;
    --ht-selection-background: rgba(59, 130, 246, 0.3);
  }

  .dark .handsontable,
  [data-theme="dark"] .handsontable,
  :root.dark .handsontable,
  .dark .handsontable td,
  .dark .handsontable th,
  [data-theme="dark"] .handsontable td,
  [data-theme="dark"] .handsontable th {
    background-color: #1f2937 !important;
    color: #f3f4f6 !important;
    border-color: #374151 !important;
  }

  .dark .handsontable thead th,
  .dark .handsontable .ht__highlight,
  [data-theme="dark"] .handsontable thead th,
  [data-theme="dark"] .handsontable .ht__highlight {
    background-color: #111827 !important;
    color: #f9fafb !important;
  }

  .dark .handsontable .htCore td.current,
  .dark .handsontable .htCore td.area,
  [data-theme="dark"] .handsontable .htCore td.current,
  [data-theme="dark"] .handsontable .htCore td.area {
    background-color: #374151 !important;
  }

  .dark .handsontable .htDimmed,
  [data-theme="dark"] .handsontable .htDimmed {
    color: #9ca3af !important;
  }

  /* Dropdown menus in dark mode */
  .dark .htDropdownMenu,
  .dark .htFiltersConditionsMenu,
  .dark .htContextMenu,
  [data-theme="dark"] .htDropdownMenu,
  [data-theme="dark"] .htFiltersConditionsMenu,
  [data-theme="dark"] .htContextMenu {
    background-color: #1f2937 !important;
    border-color: #374151 !important;
  }

  .dark .htDropdownMenu td,
  .dark .htFiltersConditionsMenu td,
  .dark .htContextMenu td,
  [data-theme="dark"] .htDropdownMenu td,
  [data-theme="dark"] .htFiltersConditionsMenu td,
  [data-theme="dark"] .htContextMenu td {
    color: #f3f4f6 !important;
  }

  .dark .htDropdownMenu td:hover,
  .dark .htContextMenu td:hover,
  [data-theme="dark"] .htDropdownMenu td:hover,
  [data-theme="dark"] .htContextMenu td:hover {
    background-color: #374151 !important;
  }

  /* Input fields in dark mode */
  .dark .handsontable input,
  .dark .handsontable select,
  .dark .handsontable textarea,
  [data-theme="dark"] .handsontable input,
  [data-theme="dark"] .handsontable select,
  [data-theme="dark"] .handsontable textarea {
    background-color: #374151 !important;
    color: #f3f4f6 !important;
    border-color: #4b5563 !important;
  }

  /* Row headers in dark mode */
  .dark .handsontable .ht_clone_left th,
  .dark .handsontable .ht_clone_top_left_corner th,
  [data-theme="dark"] .handsontable .ht_clone_left th,
  [data-theme="dark"] .handsontable .ht_clone_top_left_corner th {
    background-color: #111827 !important;
    color: #9ca3af !important;
  }

  /* Autocomplete dropdown */
  .dark .handsontableInput,
  .dark .handsontableInputHolder,
  [data-theme="dark"] .handsontableInput,
  [data-theme="dark"] .handsontableInputHolder {
    background-color: #374151 !important;
    color: #f3f4f6 !important;
  }

  .dark .htAutocomplete,
  [data-theme="dark"] .htAutocomplete {
    background-color: #1f2937 !important;
  }
`

type Product = {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  handle: string
  status: string
  thumbnail: string | null
  collection?: { id: string; title: string } | null
  categories?: Array<{ id: string; name: string }>
  variants?: Array<{
    id: string
    title: string
    sku: string | null
    prices?: Array<{
      amount: number
      currency_code: string
    }>
  }>
  images?: Array<{ id: string; url: string }>
}

type Category = {
  id: string
  name: string
}

type Collection = {
  id: string
  title: string
}

// Helper to detect dark mode
function isDarkMode() {
  return document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark" ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
}

// Custom renderer for thumbnail with image preview
function thumbnailRenderer(
  instance: Handsontable,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) {
  td.innerHTML = ""
  td.style.padding = "4px"
  td.style.cursor = "pointer"

  const dark = isDarkMode()

  if (value) {
    const container = document.createElement("div")
    container.style.display = "flex"
    container.style.alignItems = "center"
    container.style.gap = "8px"

    const img = document.createElement("img")
    img.src = value
    img.style.width = "40px"
    img.style.height = "40px"
    img.style.objectFit = "cover"
    img.style.borderRadius = "4px"
    img.style.border = dark ? "1px solid #4b5563" : "1px solid #e5e7eb"
    img.onerror = () => {
      img.style.display = "none"
    }

    const urlText = document.createElement("span")
    urlText.textContent = value.length > 30 ? value.substring(0, 30) + "..." : value
    urlText.style.fontSize = "12px"
    urlText.style.color = dark ? "#9ca3af" : "#6b7280"
    urlText.style.overflow = "hidden"
    urlText.style.textOverflow = "ellipsis"

    container.appendChild(img)
    container.appendChild(urlText)
    td.appendChild(container)
  } else {
    td.textContent = "(click to add)"
    td.style.color = dark ? "#6b7280" : "#9ca3af"
    td.style.fontStyle = "italic"
  }

  return td
}

// Custom renderer for image gallery (multiple images)
function imagesRenderer(
  instance: Handsontable,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) {
  td.innerHTML = ""
  td.style.padding = "4px"
  td.style.cursor = "pointer"

  const dark = isDarkMode()

  if (value) {
    const urls = value.split("\n").filter((u: string) => u.trim())

    const container = document.createElement("div")
    container.style.display = "flex"
    container.style.alignItems = "center"
    container.style.gap = "4px"
    container.style.flexWrap = "wrap"

    // Show up to 4 image thumbnails
    const maxShow = 4
    urls.slice(0, maxShow).forEach((url: string) => {
      const img = document.createElement("img")
      img.src = url.trim()
      img.style.width = "32px"
      img.style.height = "32px"
      img.style.objectFit = "cover"
      img.style.borderRadius = "4px"
      img.style.border = dark ? "1px solid #4b5563" : "1px solid #e5e7eb"
      img.style.cursor = "pointer"
      img.title = url.trim()
      img.onerror = () => {
        img.style.display = "none"
      }
      container.appendChild(img)
    })

    // Show count if more images
    if (urls.length > maxShow) {
      const more = document.createElement("span")
      more.textContent = `+${urls.length - maxShow}`
      more.style.fontSize = "11px"
      more.style.color = dark ? "#9ca3af" : "#6b7280"
      more.style.padding = "2px 6px"
      more.style.backgroundColor = dark ? "#374151" : "#f3f4f6"
      more.style.borderRadius = "4px"
      container.appendChild(more)
    }

    td.appendChild(container)
  } else {
    td.textContent = "(click to add)"
    td.style.color = dark ? "#6b7280" : "#9ca3af"
    td.style.fontStyle = "italic"
  }

  return td
}

const BulkEditorPage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [changedRows, setChangedRows] = useState<Set<number>>(new Set())
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const hotRef = useRef<any>(null)

  // Flatten product data for spreadsheet
  const flattenProducts = useCallback((products: Product[]) => {
    return products.map((p) => {
      const firstVariant = p.variants?.[0]
      const usdPrice = firstVariant?.prices?.find((pr) => pr.currency_code === "usd")
      return {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle || "",
        handle: p.handle,
        status: p.status,
        description: p.description || "",
        thumbnail: p.thumbnail || "",
        collection: p.collection?.title || "",
        collectionId: p.collection?.id || "",
        categories: p.categories?.map((c) => c.name).join(", ") || "",
        categoryIds: p.categories?.map((c) => c.id) || [],
        variantTitle: firstVariant?.title || "Default",
        variantId: firstVariant?.id || "",
        sku: firstVariant?.sku || "",
        price: usdPrice ? (usdPrice.amount / 100).toFixed(2) : "0.00",
        images: p.images?.map((i) => i.url).join("\n") || "",
        imageCount: p.images?.length || 0,
      }
    })
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const productsRes = await fetch(
        "/admin/products?limit=100&fields=*variants,*variants.prices,*images,*collection,*categories",
        { credentials: "include" }
      )
      if (!productsRes.ok) throw new Error("Failed to fetch products")
      const productsData = await productsRes.json()

      const categoriesRes = await fetch("/admin/product-categories?limit=100", {
        credentials: "include",
      })
      const categoriesData = await categoriesRes.json()

      const collectionsRes = await fetch("/admin/collections?limit=100", {
        credentials: "include",
      })
      const collectionsData = await collectionsRes.json()

      setProducts(productsData.products || [])
      setCategories(categoriesData.product_categories || [])
      setCollections(collectionsData.collections || [])
    } catch (err) {
      console.error(err)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Inject dark mode styles for Handsontable
  useEffect(() => {
    const styleId = "handsontable-dark-mode-styles"
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style")
      styleEl.id = styleId
      styleEl.textContent = darkModeStyles
      document.head.appendChild(styleEl)
    }
    return () => {
      // Cleanup on unmount
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  // Add an empty row at the end for new product creation
  const createEmptyRow = () => ({
    id: "",
    title: "",
    subtitle: "",
    handle: "",
    status: "draft",
    description: "",
    thumbnail: "",
    collection: "",
    collectionId: "",
    categories: "",
    categoryIds: [],
    variantTitle: "Default",
    variantId: "",
    sku: "",
    price: "0.00",
    images: "",
    imageCount: 0,
    isNew: true,
  })

  const tableData = [...flattenProducts(products), createEmptyRow()]

  const columns = [
    {
      data: "thumbnail",
      title: "Thumbnail",
      width: 180,
      renderer: thumbnailRenderer,
    },
    { data: "title", title: "Title", width: 200 },
    { data: "sku", title: "SKU", width: 120 },
    {
      data: "price",
      title: "Price (USD)",
      width: 100,
      type: "numeric",
      numericFormat: { pattern: "0.00" },
    },
    {
      data: "status",
      title: "Status",
      width: 100,
      type: "dropdown",
      source: ["draft", "published", "proposed", "rejected"],
    },
    {
      data: "images",
      title: "Images",
      width: 200,
      renderer: imagesRenderer,
    },
    {
      data: "collection",
      title: "Collection",
      width: 150,
      type: "dropdown",
      source: ["", ...collections.map((c) => c.title)],
    },
    { data: "categories", title: "Categories", width: 150, readOnly: true },
    { data: "handle", title: "Handle", width: 150 },
    { data: "subtitle", title: "Subtitle", width: 150 },
    { data: "description", title: "Description", width: 250 },
    { data: "id", title: "ID", width: 200, readOnly: true },
  ]

  const handleAfterChange = (changes: any, source: string) => {
    if (source === "loadData" || !changes) return

    setHasChanges(true)
    const newChangedRows = new Set(changedRows)
    changes.forEach(([row]: [number, string, any, any]) => {
      newChangedRows.add(row)
    })
    setChangedRows(newChangedRows)
  }

  // Handle double-click on images column to open image manager
  const handleAfterOnCellMouseDown = (event: MouseEvent, coords: { row: number; col: number }) => {
    const colName = columns[coords.col]?.data
    if (colName === "images" || colName === "thumbnail") {
      const isNewRow = coords.row >= products.length

      if (isNewRow) {
        // For new products, show a message that they need to save first
        toast.error("Save the product first before adding images")
        return
      }

      const product = products[coords.row]
      if (product) {
        setSelectedProduct(product)
        setShowImageModal(true)
      }
    }
  }

  // Custom cell renderer to highlight the new product row
  const afterGetRowHeader = (row: number, TH: HTMLTableHeaderCellElement) => {
    const isNewRow = row >= products.length
    if (isNewRow) {
      TH.style.backgroundColor = "#166534" // Green background
      TH.style.color = "#ffffff"
      TH.textContent = "+"
      TH.title = "New product row - fill in details and save"
    }
  }

  // Highlight new row cells
  const cells = (row: number, col: number): Handsontable.CellProperties => {
    const cellProperties: Handsontable.CellProperties = {}
    const isNewRow = row >= products.length

    if (isNewRow) {
      // Make new row cells editable (except ID which is auto-generated)
      if (columns[col]?.data === "id") {
        cellProperties.readOnly = true
        cellProperties.renderer = function(instance, td, row, col, prop, value, cellProperties) {
          td.textContent = "(auto)"
          td.style.color = "#6b7280"
          td.style.fontStyle = "italic"
          return td
        }
      }
    }

    return cellProperties
  }

  const saveChanges = async () => {
    if (!hotRef.current) return

    setSaving(true)
    const hot = hotRef.current.hotInstance
    const sourceData = hot.getSourceData()

    let successCount = 0
    let errorCount = 0
    let createdCount = 0

    for (const rowIndex of changedRows) {
      const rowData = sourceData[rowIndex]
      if (!rowData) continue

      // Check if this is a new product (no ID but has a title)
      const isNewProduct = !rowData.id && rowData.title && rowData.title.trim()

      if (isNewProduct) {
        // CREATE NEW PRODUCT
        try {
          // Generate handle from title if not provided
          const handle = rowData.handle?.trim() || rowData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

          const newProduct: any = {
            title: rowData.title.trim(),
            handle,
            status: rowData.status || "draft",
            is_giftcard: false,
            discountable: true,
          }

          if (rowData.subtitle?.trim()) {
            newProduct.subtitle = rowData.subtitle.trim()
          }
          if (rowData.description?.trim()) {
            newProduct.description = rowData.description.trim()
          }
          if (rowData.thumbnail?.trim()) {
            newProduct.thumbnail = rowData.thumbnail.trim()
          }

          // Add collection if selected
          if (rowData.collection) {
            const matchedCollection = collections.find((c) => c.title === rowData.collection)
            if (matchedCollection) {
              newProduct.collection_id = matchedCollection.id
            }
          }

          // Create product with a default variant
          const priceAmount = rowData.price ? Math.round(parseFloat(rowData.price) * 100) : 0
          newProduct.variants = [{
            title: "Default",
            sku: rowData.sku?.trim() || null,
            manage_inventory: false,
            prices: [{ amount: priceAmount, currency_code: "usd" }],
          }]

          // Add images if provided
          if (rowData.images?.trim()) {
            const imageUrls = rowData.images.split("\n").filter((u: string) => u.trim())
            if (imageUrls.length > 0) {
              newProduct.images = imageUrls.map((url: string) => ({ url: url.trim() }))
            }
          }

          const createRes = await fetch("/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(newProduct),
          })

          if (!createRes.ok) {
            const errorData = await createRes.json().catch(() => ({}))
            throw new Error(errorData.message || `Failed to create product: ${rowData.title}`)
          }

          createdCount++
          successCount++
        } catch (err: any) {
          console.error(`Error creating product:`, err)
          toast.error(`Failed to create "${rowData.title}": ${err.message || "Unknown error"}`)
          errorCount++
        }
      } else if (rowData.id) {
        // UPDATE EXISTING PRODUCT
        try {
          const productUpdate: any = {
            title: rowData.title,
            subtitle: rowData.subtitle || null,
            handle: rowData.handle,
            status: rowData.status,
            description: rowData.description || null,
          }

          if (rowData.collection) {
            const matchedCollection = collections.find((c) => c.title === rowData.collection)
            if (matchedCollection) {
              productUpdate.collection_id = matchedCollection.id
            }
          } else {
            productUpdate.collection_id = null
          }

          // Update thumbnail
          if (rowData.thumbnail !== products[rowIndex]?.thumbnail) {
            productUpdate.thumbnail = rowData.thumbnail || null
          }

          const productRes = await fetch(`/admin/products/${rowData.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(productUpdate),
          })

          if (!productRes.ok) {
            throw new Error(`Failed to update product ${rowData.id}`)
          }

          // Update variant price
          if (rowData.variantId && rowData.price) {
            const priceAmount = Math.round(parseFloat(rowData.price) * 100)
            await fetch(`/admin/products/${rowData.id}/variants/${rowData.variantId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                prices: [{ amount: priceAmount, currency_code: "usd" }],
              }),
            })
          }

          successCount++
        } catch (err) {
          console.error(`Error updating row ${rowIndex}:`, err)
          errorCount++
        }
      }
      // Skip rows with no ID and no title (empty rows)
    }

    setSaving(false)
    setChangedRows(new Set())
    setHasChanges(false)

    if (errorCount === 0) {
      if (createdCount > 0) {
        toast.success(`Created ${createdCount} new product(s), updated ${successCount - createdCount} existing`)
      } else {
        toast.success(`Successfully updated ${successCount} products`)
      }
    } else {
      toast.error(`Saved ${successCount} products, ${errorCount} failed`)
    }

    await fetchData()
  }

  const exportCSV = () => {
    if (!hotRef.current) return
    const hot = hotRef.current.hotInstance
    const exportPlugin = hot.getPlugin("exportFile")
    exportPlugin.downloadFile("csv", {
      filename: `products-export-${new Date().toISOString().split("T")[0]}`,
      columnHeaders: true,
      rowHeaders: false,
    })
    toast.success("CSV exported")
  }

  // Image Manager Modal Component
  const ImageManagerModal = () => {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!selectedProduct || !showImageModal) return null

    const dark = isDarkMode()

    const closeModal = () => {
      setShowImageModal(false)
      setSelectedProduct(null)
    }

    const setAsThumbnail = async (imageUrl: string) => {
      // Optimistic UI update - immediately show the change
      const previousThumbnail = selectedProduct.thumbnail
      setSelectedProduct((prev) =>
        prev ? { ...prev, thumbnail: imageUrl } : null
      )

      // Also update the products array for the spreadsheet
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id ? { ...p, thumbnail: imageUrl } : p
        )
      )

      try {
        const response = await fetch(`/admin/products/${selectedProduct.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ thumbnail: imageUrl }),
        })

        if (!response.ok) {
          throw new Error("Failed to update thumbnail")
        }

        toast.success("Thumbnail updated")
      } catch (err) {
        // Revert on error
        setSelectedProduct((prev) =>
          prev ? { ...prev, thumbnail: previousThumbnail } : null
        )
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id ? { ...p, thumbnail: previousThumbnail } : p
          )
        )
        toast.error("Failed to update thumbnail")
      }
    }

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return

      setUploading(true)

      try {
        // First, upload files to get URLs
        const formData = new FormData()
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i])
        }

        const uploadResponse = await fetch("/admin/uploads", {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload images")
        }

        const uploadData = await uploadResponse.json()
        const newUrls = uploadData.files?.map((f: { url: string }) => f.url) || []

        if (newUrls.length === 0) {
          throw new Error("No files uploaded")
        }

        // Now add images to the product
        const existingImages = selectedProduct.images || []
        const newImages = newUrls.map((url: string, idx: number) => ({
          id: `temp-${Date.now()}-${idx}`,
          url,
        }))
        const allImages = [...existingImages, ...newImages]

        const updateResponse = await fetch(`/admin/products/${selectedProduct.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            images: allImages.map((img) => ({ url: img.url })),
          }),
        })

        if (!updateResponse.ok) {
          throw new Error("Failed to add images to product")
        }

        // Optimistic update - immediately update local state
        setSelectedProduct((prev) =>
          prev ? { ...prev, images: allImages } : null
        )
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id ? { ...p, images: allImages } : p
          )
        )

        toast.success(`${newUrls.length} image(s) uploaded`)
      } catch (err) {
        console.error("Upload error:", err)
        toast.error("Failed to upload images")
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }

    const deleteImage = async (imageUrl: string) => {
      if (!confirm("Remove this image from the product?")) return

      // Store previous state for rollback
      const previousImages = selectedProduct.images || []
      const previousThumbnail = selectedProduct.thumbnail
      const remainingImages = previousImages.filter((i) => i.url !== imageUrl)
      const newThumbnail = previousThumbnail === imageUrl ? null : previousThumbnail

      // Optimistic update - immediately update UI
      setSelectedProduct((prev) => {
        if (!prev) return null
        return {
          ...prev,
          images: remainingImages,
          thumbnail: newThumbnail,
        }
      })
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id
            ? { ...p, images: remainingImages, thumbnail: newThumbnail }
            : p
        )
      )

      try {
        const response = await fetch(`/admin/products/${selectedProduct.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            images: remainingImages.map((i) => ({ url: i.url })),
            ...(previousThumbnail === imageUrl ? { thumbnail: null } : {}),
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to remove image")
        }

        toast.success("Image removed")
      } catch (err) {
        // Rollback on error
        setSelectedProduct((prev) => {
          if (!prev) return null
          return {
            ...prev,
            images: previousImages,
            thumbnail: previousThumbnail,
          }
        })
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id
              ? { ...p, images: previousImages, thumbnail: previousThumbnail }
              : p
          )
        )
        toast.error("Failed to remove image")
      }
    }

    const modalBg = dark ? "#1f2937" : "white"
    const cardBg = dark ? "#374151" : "#f9fafb"
    const borderColor = dark ? "#4b5563" : "#e5e7eb"
    const textColor = dark ? "#f3f4f6" : "#111827"
    const subtleColor = dark ? "#9ca3af" : "#6b7280"

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={closeModal}
      >
        <div
          style={{
            backgroundColor: modalBg,
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "900px",
            width: "90%",
            maxHeight: "85vh",
            overflow: "auto",
            color: textColor,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <Heading level="h2" style={{ color: textColor }}>Manage Images</Heading>
              <Text style={{ color: subtleColor }}>{selectedProduct.title}</Text>
            </div>
            <Button variant="secondary" size="small" onClick={closeModal}>Close</Button>
          </div>

          {/* Upload Section */}
          <div
            style={{
              padding: "20px",
              border: `2px dashed ${borderColor}`,
              borderRadius: "8px",
              textAlign: "center",
              marginBottom: "24px",
              backgroundColor: cardBg,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleUpload}
              style={{ display: "none" }}
              id="image-upload"
            />
            <PhotoSolid style={{ width: "32px", height: "32px", color: subtleColor, margin: "0 auto 8px" }} />
            <Text style={{ color: subtleColor, marginBottom: "12px", display: "block" }}>
              Drag & drop images here, or click to browse
            </Text>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload Images"}
            </Button>
          </div>

          {/* Current Thumbnail Preview */}
          <div style={{ marginBottom: "24px" }}>
            <Text style={{ fontWeight: 600, color: textColor, marginBottom: "8px", display: "block" }}>
              Current Thumbnail
            </Text>
            {selectedProduct.thumbnail ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={selectedProduct.thumbnail}
                  alt="Thumbnail"
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    border: "3px solid #10b981",
                  }}
                />
                <Text style={{ color: subtleColor, fontSize: "14px" }}>
                  This image appears as the product thumbnail in listings
                </Text>
              </div>
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  backgroundColor: cardBg,
                  borderRadius: "8px",
                  border: `2px dashed ${borderColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: subtleColor, fontSize: "12px" }}>None</Text>
              </div>
            )}
          </div>

          {/* All Images Grid */}
          <div>
            <Text style={{ fontWeight: 600, color: textColor, marginBottom: "12px", display: "block" }}>
              Product Images ({selectedProduct.images?.length || 0})
            </Text>

            {(!selectedProduct.images || selectedProduct.images.length === 0) ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  backgroundColor: cardBg,
                  borderRadius: "8px",
                }}
              >
                <Text style={{ color: subtleColor }}>No images yet. Upload some images above.</Text>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
                {selectedProduct.images?.map((img, idx) => {
                  const isThumbnail = img.url === selectedProduct.thumbnail

                  return (
                    <div
                      key={img.id}
                      style={{
                        position: "relative",
                        backgroundColor: cardBg,
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: isThumbnail
                          ? "3px solid #10b981"
                          : `1px solid ${borderColor}`,
                      }}
                    >
                      {/* Thumbnail badge */}
                      {isThumbnail && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            backgroundColor: "#10b981",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            zIndex: 1,
                          }}
                        >
                          Thumbnail
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => deleteImage(img.url)}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: "rgba(239, 68, 68, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          width: "24px",
                          height: "24px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          zIndex: 1,
                        }}
                        title="Remove image"
                      >
                        ×
                      </button>

                      <img
                        src={img.url}
                        alt={`Image ${idx + 1}`}
                        style={{ width: "100%", height: "140px", objectFit: "cover" }}
                      />

                      <div style={{ padding: "8px" }}>
                        {!isThumbnail && (
                          <Button
                            variant="secondary"
                            size="small"
                            style={{ width: "100%", fontSize: "12px" }}
                            onClick={() => setAsThumbnail(img.url)}
                          >
                            Set as Thumbnail
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <ImageManagerModal />
      <Container className="p-0 max-w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <Heading level="h1">Bulk Product Editor</Heading>
            <Text className="text-ui-fg-subtle">
              Edit products in a spreadsheet view. Double-click images to manage them.
            </Text>
          </div>
          <div className="flex gap-2 items-center">
            {hasChanges && (
              <Badge color="orange">{changedRows.size} unsaved changes</Badge>
            )}
            <Button variant="secondary" onClick={exportCSV} disabled={loading}>
              <ArrowDownTray />
              Export CSV
            </Button>
            <Button onClick={saveChanges} disabled={!hasChanges || saving || loading}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Text>Loading products...</Text>
            </div>
          ) : (
            <div style={{ width: "100%", minHeight: "600px" }}>
              <HotTable
                ref={hotRef}
                data={tableData}
                columns={columns}
                colHeaders={true}
                rowHeaders={true}
                width="100%"
                height={600}
                stretchH="all"
                manualColumnResize={true}
                manualRowResize={true}
                contextMenu={true}
                filters={true}
                dropdownMenu={true}
                multiColumnSorting={true}
                autoWrapRow={true}
                autoWrapCol={true}
                afterChange={handleAfterChange}
                afterOnCellMouseDown={handleAfterOnCellMouseDown}
                afterGetRowHeader={afterGetRowHeader}
                cells={cells}
                licenseKey="non-commercial-and-evaluation"
                rowHeights={50}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-ui-bg-subtle">
          <Text className="text-ui-fg-subtle text-sm">
            <strong>Tips:</strong> The last row (marked with +) is for creating new products - fill in at least a Title and click Save.
            Click on thumbnail/images to manage product images. Use dropdowns for Status and Collection.
          </Text>
        </div>
      </Container>
    </>
  )
}

export const config = defineRouteConfig({
  label: "Bulk Editor",
  icon: SquaresPlus,
})

export default BulkEditorPage
