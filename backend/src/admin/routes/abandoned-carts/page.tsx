import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingCart } from "@medusajs/icons"
import { Container, Heading, Table, Text, Badge, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

type AbandonedCart = {
  id: string
  email: string | null
  created_at: string
  updated_at: string
  items: Array<{
    id: string
    title: string
    quantity: number
    unit_price: number
  }>
  total: number
  shipping_address?: {
    first_name?: string
    last_name?: string
    phone?: string
  }
  currency_code: string
}

const AbandonedCartsPage = () => {
  const [carts, setCarts] = useState<AbandonedCart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoursThreshold, setHoursThreshold] = useState(24)

  const fetchAbandonedCarts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/admin/abandoned-carts?hours=${hoursThreshold}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to fetch abandoned carts")
      const data = await response.json()
      setCarts(data.carts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAbandonedCarts()
  }, [hoursThreshold])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency?.toUpperCase() || "USD",
    }).format(amount / 100)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    }
  }

  const getCustomerName = (cart: AbandonedCart) => {
    if (cart.shipping_address?.first_name) {
      return `${cart.shipping_address.first_name} ${cart.shipping_address.last_name || ''}`.trim()
    }
    return cart.email?.split('@')[0] || 'Unknown'
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Abandoned Checkouts</Heading>
          <Text className="text-ui-fg-subtle">
            Customers who started checkout but didn't complete their order
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hoursThreshold}
            onChange={(e) => setHoursThreshold(Number(e.target.value))}
            className="rounded-md border border-ui-border-base px-3 py-2 text-sm"
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
          <Button variant="secondary" onClick={fetchAbandonedCarts}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Text>Loading abandoned carts...</Text>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-10">
            <Text className="text-ui-fg-error">{error}</Text>
          </div>
        ) : carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <ShoppingCart className="text-ui-fg-muted mb-2 h-10 w-10" />
            <Text className="text-ui-fg-muted">No abandoned carts found</Text>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Badge color="orange">{carts.length} abandoned checkout{carts.length !== 1 ? 's' : ''}</Badge>
            </div>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Email</Table.HeaderCell>
                  <Table.HeaderCell>Phone</Table.HeaderCell>
                  <Table.HeaderCell>Items</Table.HeaderCell>
                  <Table.HeaderCell>Total</Table.HeaderCell>
                  <Table.HeaderCell>Abandoned</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {carts.map((cart) => (
                  <Table.Row key={cart.id} className="cursor-pointer hover:bg-ui-bg-subtle">
                    <Table.Cell>
                      <Text className="font-medium">{getCustomerName(cart)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text>{cart.email || '-'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text>{cart.shipping_address?.phone || '-'}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text>{cart.items?.length || 0} item{(cart.items?.length || 0) !== 1 ? 's' : ''}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="font-medium">
                        {formatCurrency(cart.total, cart.currency_code)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-ui-fg-subtle">{formatDate(cart.updated_at)}</Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Abandoned Carts",
  icon: ShoppingCart,
})

export default AbandonedCartsPage
