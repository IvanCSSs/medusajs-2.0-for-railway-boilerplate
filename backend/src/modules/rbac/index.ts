import { Module } from "@medusajs/framework/utils"
import { RBACModuleService } from "./service"

export const RBAC_MODULE = "rbac"

export { RBACModuleService }

export default Module(RBAC_MODULE, {
  service: RBACModuleService,
})
