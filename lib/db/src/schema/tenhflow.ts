import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type TenhflowRecordType =
  | "settings"
  | "customer"
  | "product"
  | "capture"
  | "order"
  | "conversation"
  | "activity";

export const tenhflowRecordsTable = pgTable(
  "tenhflow_records",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    recordType: text("record_type").$type<TenhflowRecordType>().notNull(),
    recordId: text("record_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("tenhflow_records_owner_type_record_idx").on(
      table.ownerId,
      table.recordType,
      table.recordId,
    ),
    index("tenhflow_records_owner_type_idx").on(
      table.ownerId,
      table.recordType,
    ),
  ],
);
