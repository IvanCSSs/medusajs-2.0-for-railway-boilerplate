import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminCustomer } from "@medusajs/framework/types"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Activity = {
  id: string
  customer_id: string
  event_type: string
  event_name: string
  description?: string
  metadata?: Record<string, any>
  created_at: string
  time?: string
}

type GroupedActivities = Record<string, Activity[]>

// Icon mapping for different event types (using text symbols)
const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "order.placed":
      return <span className="text-green-500">$</span>
    case "order.canceled":
      return <span className="text-red-500">&#10005;</span>
    case "order.completed":
      return <span className="text-green-600">&#10003;</span>
    case "customer.created":
      return <span className="text-blue-500">&#128100;</span>
    case "customer.updated":
      return <span className="text-gray-500">&#8635;</span>
    case "cart.created":
    case "cart.updated":
      return <span className="text-orange-500">&#128722;</span>
    case "fulfillment.created":
    case "fulfillment.shipment_created":
      return <span className="text-purple-500">&#128666;</span>
    case "notification.sent":
      return <span className="text-blue-400">&#9993;</span>
    case "return.created":
    case "claim.created":
      return <span className="text-yellow-500">&#8617;</span>
    default:
      return <span className="text-gray-400">&#8226;</span>
  }
}

// Badge color for event types
const getEventBadgeColor = (eventType: string): "green" | "red" | "blue" | "orange" | "purple" | "grey" => {
  if (eventType.includes("order.placed") || eventType.includes("completed")) return "green"
  if (eventType.includes("canceled") || eventType.includes("failed")) return "red"
  if (eventType.includes("customer")) return "blue"
  if (eventType.includes("cart")) return "orange"
  if (eventType.includes("fulfillment") || eventType.includes("ship")) return "purple"
  return "grey"
}

const CustomerTimelineWidget = ({ data }: DetailWidgetProps<AdminCustomer>) => {
  const [activities, setActivities] = useState<Activity[]>([])
  const [grouped, setGrouped] = useState<GroupedActivities>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch(`/admin/customers/${data.id}/timeline?limit=100`, {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch timeline")
        }

        const result = await response.json()
        setActivities(result.activities || [])
        setGrouped(result.grouped || {})
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    if (data?.id) {
      fetchTimeline()
    }
  }, [data?.id])

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Activity Timeline</Heading>
        </div>
        <div className="px-6 py-8 text-center">
          <Text className="text-ui-fg-subtle">Loading timeline...</Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Activity Timeline</Heading>
        </div>
        <div className="px-6 py-8 text-center">
          <Text className="text-ui-fg-error">{error}</Text>
        </div>
      </Container>
    )
  }

  const dateKeys = Object.keys(grouped)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Activity Timeline</Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Customer actions and events
          </Text>
        </div>
        {activities.length > 0 && (
          <Badge color="grey">{activities.length} events</Badge>
        )}
      </div>

      <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
        {dateKeys.length === 0 ? (
          <div className="text-center py-8">
            <Text className="text-ui-fg-muted text-2xl mb-2">&#128100;</Text>
            <Text className="text-ui-fg-subtle">No activity recorded yet</Text>
          </div>
        ) : (
          <div className="space-y-6">
            {dateKeys.map((date) => (
              <div key={date}>
                <Text className="text-ui-fg-subtle text-xs font-medium uppercase tracking-wider mb-3">
                  {date}
                </Text>
                <div className="space-y-3">
                  {grouped[date].map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors"
                    >
                      <div className="flex-shrink-0 mt-0.5 text-base">
                        {getEventIcon(activity.event_type)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Text className="font-medium text-sm">
                            {activity.event_name}
                          </Text>
                          <Badge color={getEventBadgeColor(activity.event_type)} size="2xsmall">
                            {activity.event_type.split(".")[0]}
                          </Badge>
                        </div>
                        {activity.description && (
                          <Text className="text-ui-fg-subtle text-xs mt-0.5">
                            {activity.description}
                          </Text>
                        )}
                      </div>
                      <Text className="text-ui-fg-muted text-xs flex-shrink-0">
                        {activity.time}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.after",
})

export default CustomerTimelineWidget
