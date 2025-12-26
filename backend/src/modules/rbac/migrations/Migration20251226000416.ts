import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20251226000416 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "rbac_permission" ("id" text not null, "action" text check ("action" in ('read', 'write', 'delete')) not null, "resource" text not null, "name" text not null, "description" text null, "category" text not null default 'General', "is_system" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_permission_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_permission_deleted_at" ON "rbac_permission" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rbac_policy" ("id" text not null, "role_id" text not null, "permission_id" text not null, "decision" text check ("decision" in ('allow', 'deny')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_policy_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_policy_deleted_at" ON "rbac_policy" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rbac_role" ("id" text not null, "name" text not null, "description" text null, "is_system" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_role_deleted_at" ON "rbac_role" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "rbac_user_role" ("id" text not null, "user_id" text not null, "role_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rbac_user_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rbac_user_role_deleted_at" ON "rbac_user_role" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "rbac_permission" cascade;`);

    this.addSql(`drop table if exists "rbac_policy" cascade;`);

    this.addSql(`drop table if exists "rbac_role" cascade;`);

    this.addSql(`drop table if exists "rbac_user_role" cascade;`);
  }

}
