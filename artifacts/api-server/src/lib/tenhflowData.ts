import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, tenhflowRecordsTable } from "@workspace/db";
import type { TenhflowRecordType } from "@workspace/db";

type RecordPayload = Record<string, unknown>;

const now = Date.now();
const minutesAgo = (minutes: number) =>
  new Date(now - minutes * 60_000).toISOString();

const demoSettings = {
  shopName: "Rith Fashion",
  category: "Fashion",
  phone: "+855 12 345 678",
  address: "Toul Kork, Phnom Penh",
  currency: "USD",
  defaultDeliveryFee: 2,
  defaultPaymentMethod: "COD",
  orderPrefix: "ORD",
  appearance: "light",
  onboarded: false,
  channels: [
    {
      name: "Facebook",
      state: "Not Connected",
      description: "Connect your Page to bring comments into Capture.",
    },
    {
      name: "Messenger",
      state: "Not Connected",
      description: "Messenger connection is not enabled for this demo.",
    },
    {
      name: "Telegram",
      state: "Not Connected",
      description: "Telegram connection is not enabled for this demo.",
    },
    {
      name: "TikTok",
      state: "Coming Soon",
      description: "TikTok order capture is planned for a future release.",
    },
  ],
};

const demoCustomers = [
  {
    id: "customer-sokha",
    name: "Sokha",
    phone: "+855 12 555 104",
    address: "Toul Kork, Phnom Penh",
    platform: "Facebook",
    since: "2026-03-12",
    totalOrders: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    totalSpent: 0,
    reliability: 95,
    notes: "",
  },
  {
    id: "customer-dara",
    name: "Dara",
    phone: "+855 10 220 781",
    address: "Sen Sok, Phnom Penh",
    platform: "Telegram",
    since: "2026-05-02",
    totalOrders: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    totalSpent: 0,
    reliability: 100,
    notes: "",
  },
  {
    id: "customer-vanna",
    name: "Vanna",
    phone: "+855 96 840 221",
    address: "Chamkarmon, Phnom Penh",
    platform: "Messenger",
    since: "2026-06-18",
    totalOrders: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    totalSpent: 0,
    reliability: 90,
    notes: "",
  },
];

const demoProducts = [
  {
    id: "product-a01",
    name: "Basic T-Shirt",
    code: "A01",
    price: 8,
    stock: 42,
    category: "Tops",
    colors: ["Black", "White", "Blue"],
    sizes: ["S", "M", "L", "XL"],
    active: true,
  },
  {
    id: "product-a02",
    name: "Oversized T-Shirt",
    code: "A02",
    price: 10,
    stock: 18,
    category: "Tops",
    colors: ["White", "Sand", "Black"],
    sizes: ["S", "M", "L", "XL"],
    active: true,
  },
  {
    id: "product-a03",
    name: "Everyday Hoodie",
    code: "A03",
    price: 18,
    stock: 8,
    category: "Outerwear",
    colors: ["Gray", "Black"],
    sizes: ["M", "L", "XL"],
    active: true,
  },
];

const demoOrders = [
  {
    id: "ORD-10482",
    customerId: "customer-sokha",
    customerName: "Sokha",
    phone: "+855 12 555 104",
    address: "Toul Kork, Phnom Penh",
    productCode: "A01",
    productName: "Basic T-Shirt",
    color: "Black",
    size: "M",
    quantity: 2,
    subtotal: 16,
    deliveryFee: 2,
    total: 18,
    paymentMethod: "COD",
    paymentStatus: "Pending",
    paid: 0,
    deliveryMethod: "Own Rider",
    rider: "Dara",
    deliveryStatus: "Out for Delivery",
    status: "Out for Delivery",
    channel: "Facebook",
    createdAt: minutesAgo(25),
  },
  {
    id: "ORD-10481",
    customerId: "customer-dara",
    customerName: "Dara",
    phone: "+855 10 220 781",
    address: "Sen Sok, Phnom Penh",
    productCode: "A02",
    productName: "Oversized T-Shirt",
    color: "White",
    size: "L",
    quantity: 1,
    subtotal: 10,
    deliveryFee: 2,
    total: 12,
    paymentMethod: "Bank Transfer",
    paymentStatus: "Paid",
    paid: 12,
    deliveryMethod: "Own Rider",
    rider: "Sovann",
    deliveryStatus: "Assigned",
    status: "Packing",
    channel: "Telegram",
    createdAt: minutesAgo(54),
  },
  {
    id: "ORD-10480",
    customerId: "customer-vanna",
    customerName: "Vanna",
    phone: "+855 96 840 221",
    address: "Chamkarmon, Phnom Penh",
    productCode: "A03",
    productName: "Everyday Hoodie",
    color: "Gray",
    size: "L",
    quantity: 1,
    subtotal: 18,
    deliveryFee: 2,
    total: 20,
    paymentMethod: "KHQR",
    paymentStatus: "Paid",
    paid: 20,
    deliveryMethod: "Own Rider",
    rider: "Sovann",
    deliveryStatus: "Delivered",
    status: "Delivered",
    channel: "Messenger",
    createdAt: minutesAgo(130),
  },
];

const demoCaptures = [
  {
    id: "capture-sokha",
    customerName: "Sokha",
    customerId: "customer-sokha",
    snippet: "A01 black M x2",
    channel: "Facebook Comment",
    status: "Ready to Order",
    productCode: "A01",
    productName: "Basic T-Shirt",
    color: "Black",
    size: "M",
    quantity: 2,
    unitPrice: 8,
    deliveryFee: 2,
    phone: "+855 12 555 104",
    address: "Toul Kork, Phnom Penh",
    confidence: 96,
    createdAt: minutesAgo(3),
    missing: [],
  },
  {
    id: "capture-dara",
    customerName: "Dara",
    customerId: null,
    snippet: "បងយក A02 ពណ៌ស size L មួយ",
    channel: "Telegram",
    status: "Missing Info",
    productCode: "A02",
    productName: "Oversized T-Shirt",
    color: "White",
    size: "L",
    quantity: 1,
    unitPrice: 10,
    deliveryFee: 2,
    phone: null,
    address: null,
    confidence: 89,
    createdAt: minutesAgo(8),
    missing: ["Phone", "Address"],
  },
  {
    id: "capture-vanna",
    customerName: "Vanna",
    customerId: "customer-vanna",
    snippet: "A03 gray L x2",
    channel: "Messenger",
    status: "Ready to Order",
    productCode: "A03",
    productName: "Everyday Hoodie",
    color: "Gray",
    size: "L",
    quantity: 2,
    unitPrice: 18,
    deliveryFee: 2,
    phone: "+855 96 840 221",
    address: "Chamkarmon, Phnom Penh",
    confidence: 62,
    createdAt: minutesAgo(15),
    missing: [],
  },
];

const demoConversations = [
  {
    id: "conversation-sokha",
    customerId: "customer-sokha",
    customerName: "Sokha",
    snippet: "A01 black M x2",
    channel: "Facebook",
    category: "order_intent",
    time: "2 min",
    productCode: "A01",
    color: "Black",
    size: "M",
    quantity: 2,
    messages: [
      { id: "msg-s1", sender: "Customer", text: "A01 black M x2", time: "10:42" },
      { id: "msg-s2", sender: "Seller", text: "Yes, available. Same address?", time: "10:43" },
      { id: "msg-s3", sender: "Customer", text: "Yes, Toul Kork please.", time: "10:44" },
    ],
  },
  {
    id: "conversation-dara",
    customerId: null,
    customerName: "Dara",
    snippet: "How much is delivery to Sen Sok?",
    channel: "Telegram",
    category: "new",
    time: "8 min",
    productCode: "A02",
    color: "White",
    size: "L",
    quantity: 1,
    messages: [
      { id: "msg-d1", sender: "Customer", text: "How much is delivery to Sen Sok?", time: "10:37" },
      { id: "msg-d2", sender: "Seller", text: "Delivery is $2 in Phnom Penh.", time: "10:39" },
    ],
  },
  {
    id: "conversation-vanna",
    customerId: "customer-vanna",
    customerName: "Vanna",
    snippet: "A03 gray L x2",
    channel: "Messenger",
    category: "follow_up",
    time: "15 min",
    productCode: "A03",
    color: "Gray",
    size: "L",
    quantity: 2,
    messages: [
      { id: "msg-v1", sender: "Customer", text: "A03 gray L x2", time: "10:30" },
      { id: "msg-v2", sender: "Seller", text: "Got it. Can you confirm your address?", time: "10:32" },
    ],
  },
];

const demoActivity = [
  {
    id: "activity-1",
    title: "Sokha's order is out for delivery",
    detail: "ORD-10482 · A01 Basic T-Shirt ×2",
    time: "3 min ago",
    channel: "delivery",
  },
  {
    id: "activity-2",
    title: "Dara's payment was received",
    detail: "ORD-10481 · Bank Transfer · $12.00",
    time: "9 min ago",
    channel: "payment",
  },
  {
    id: "activity-3",
    title: "New potential order from Vanna",
    detail: "A03 gray L ×2 · needs a quick review",
    time: "15 min ago",
    channel: "capture",
  },
];

async function insertIfMissing(
  ownerId: string,
  recordType: TenhflowRecordType,
  recordId: string,
  payload: RecordPayload,
): Promise<void> {
  await db
    .insert(tenhflowRecordsTable)
    .values({
      id: randomUUID(),
      ownerId,
      recordType,
      recordId,
      payload,
    })
    .onConflictDoNothing({
      target: [
        tenhflowRecordsTable.ownerId,
        tenhflowRecordsTable.recordType,
        tenhflowRecordsTable.recordId,
      ],
    });
}

export async function ensureTenhflowDemoData(ownerId: string): Promise<void> {
  const [settings] = await db
    .select({ id: tenhflowRecordsTable.id })
    .from(tenhflowRecordsTable)
    .where(
      and(
        eq(tenhflowRecordsTable.ownerId, ownerId),
        eq(tenhflowRecordsTable.recordType, "settings"),
      ),
    )
    .limit(1);

  if (settings) return;

  await insertIfMissing(ownerId, "settings", "shop", demoSettings);
  for (const customer of demoCustomers)
    await insertIfMissing(ownerId, "customer", customer.id, customer);
  for (const product of demoProducts)
    await insertIfMissing(ownerId, "product", product.id, product);
  for (const capture of demoCaptures)
    await insertIfMissing(ownerId, "capture", capture.id, capture);
  for (const order of demoOrders)
    await insertIfMissing(ownerId, "order", order.id, order);
  for (const conversation of demoConversations)
    await insertIfMissing(
      ownerId,
      "conversation",
      conversation.id,
      conversation,
    );
  for (const event of demoActivity)
    await insertIfMissing(ownerId, "activity", event.id, event);
}

export async function listRecords<T>(
  ownerId: string,
  recordType: TenhflowRecordType,
): Promise<T[]> {
  const rows = await db
    .select({ payload: tenhflowRecordsTable.payload })
    .from(tenhflowRecordsTable)
    .where(
      and(
        eq(tenhflowRecordsTable.ownerId, ownerId),
        eq(tenhflowRecordsTable.recordType, recordType),
      ),
    )
    .orderBy(asc(tenhflowRecordsTable.createdAt));
  return rows.map(({ payload }) => payload as T);
}

export async function getRecord<T>(
  ownerId: string,
  recordType: TenhflowRecordType,
  recordId: string,
): Promise<T | undefined> {
  const [row] = await db
    .select({ payload: tenhflowRecordsTable.payload })
    .from(tenhflowRecordsTable)
    .where(
      and(
        eq(tenhflowRecordsTable.ownerId, ownerId),
        eq(tenhflowRecordsTable.recordType, recordType),
        eq(tenhflowRecordsTable.recordId, recordId),
      ),
    )
    .limit(1);
  return row?.payload as T | undefined;
}

export async function saveRecord<T>(
  ownerId: string,
  recordType: TenhflowRecordType,
  recordId: string,
  payload: T,
): Promise<void> {
  await db
    .insert(tenhflowRecordsTable)
    .values({
      id: randomUUID(),
      ownerId,
      recordType,
      recordId,
      payload: payload as RecordPayload,
    })
    .onConflictDoUpdate({
      target: [
        tenhflowRecordsTable.ownerId,
        tenhflowRecordsTable.recordType,
        tenhflowRecordsTable.recordId,
      ],
      set: { payload: payload as RecordPayload, updatedAt: new Date() },
    });
}

export function getMissingCustomerFields(customer: {
  phone?: string | null;
  address?: string | null;
}): string[] {
  return [
    ...(customer.phone?.trim() ? [] : ["Phone"]),
    ...(customer.address?.trim() ? [] : ["Address"]),
  ];
}
