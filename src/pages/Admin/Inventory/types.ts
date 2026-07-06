export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface InventoryProduct {
  id: string
  name: string
  slug: string
  images: string[]
  categoryName: string
  stockQuantity: number
  reservedStock: number
  availableStock: number
  incomingStock: number
  damagedStock: number
  returnedStock: number
  lowStockThreshold: number
  stockStatus: StockStatus
}

export interface StockMovement {
  id: string
  productId: string
  type: string
  quantityDelta: number
  resultingStock: number
  referenceType?: string | null
  referenceId?: string | null
  note?: string | null
  createdAt: string
}

export type PurchaseStatus = 'ordered' | 'received' | 'cancelled'

export interface Purchase {
  id: string
  productId: string
  supplierName: string
  purchaseDate: string | null
  unitCost: number
  quantity: number
  totalCost: number
  invoiceNumber?: string | null
  batchNumber?: string | null
  expiryDate?: string | null
  notes?: string | null
  status: PurchaseStatus
  createdAt: string
  updatedAt: string
}
