import { Module } from "@medusajs/framework/utils"
import CustomerActivityModuleService from "./service"

export const CUSTOMER_ACTIVITY_MODULE = "customerActivityModuleService"

export default Module(CUSTOMER_ACTIVITY_MODULE, {
  service: CustomerActivityModuleService,
})
