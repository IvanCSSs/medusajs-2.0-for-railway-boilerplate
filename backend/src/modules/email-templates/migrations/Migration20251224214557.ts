import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20251224214557 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "email_template" ("id" text not null, "name" text not null, "subject" text not null, "description" text null, "event_name" text not null, "html_content" text not null, "is_active" boolean not null default true, "variables" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_template_deleted_at" ON "email_template" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_template" cascade;`);
  }

}
