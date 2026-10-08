import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Router, type IRouter, type RequestHandler } from "express";
import {
  type Activity,
  type Capture,
  type Conversation,
  type Customer,
  type Order as OrderRecord,
  type Product,
  type ShopSettings as Settings,
  ConfirmCaptureBody,
  ConfirmCaptureParams,
  ConfirmCaptureResponse,
  CreateCaptureBody,
  CreateCustomerBody,
  CreateCustomerResponse,
  CreateProductBody,
  CreateProductResponse,
  GetCustomerParams,
  GetCustomerResponse,
  GetOrderParams,
  GetOrderResponse,
  GetSettingsResponse,
  GetTenhflowActivityResponse,
  GetTenhflowDashboardResponse,
  ListCapturesResponse,
  ListConversationsResponse,
  ListCustomersResponse,
  ListDeliveriesResponse,
  ListOrdersResponse,
  ListPaymentsResponse,
  ListProductsResponse,
  UpdateCaptureBody,
  UpdateCaptureParams,
  UpdateCaptureResponse,
  UpdateConversationBody,
  UpdateConversationParams,
  UpdateConversationResponse,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerResponse,
  UpdateDeliveryBody,
  UpdateDeliveryParams,
  UpdateDeliveryResponse,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
  UpdatePaymentBody,
  UpdatePaymentParams,
  UpdatePaymentResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import {
  getMissingCustomerFields,
  getRecord,
  ensureTenhflowDemoData,
  listRecords,
  saveRecord,
} from "../lib/tenhflowData";

const router: IRouter = Router();

const requireTenhflowAuth: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  const authenticatedUserId = auth?.userId;
  if (!authenticatedUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await ensureTenhflowDemoData(authenticatedUserId);
  res.locals.ownerId = authenticatedUserId;
  next();
};

router.use("/tenhflow", requireTenhflowAuth);

function ownerId(res: { locals: Record<string, unknown> }): string {
  return res.locals.ownerId as string;
}

function missingCaptureFields(capture: Partial<Capture>): string[] {
  return [
    ...(capture.productCode?.trim() ? [] : ["Product"]),
    ...(capture.color?.trim() && capture.size?.trim() ? [] : ["Variant"]),
    ...getMissingCustomerFields({
      phone: capture.phone,
      address: capture.address,
    }),
  ];
}

function parseQuantity(message: string): number {
  const khmerNumerals: Record<string, string> = {
    "០": "0",
    "១": "1",
    "២": "2",
    "៣": "3",
    "៤": "4",
    "៥": "5",
    "៦": "6",
    "៧": "7",
    "៨": "8",
    "៩": "9",
  };
  const normalized = message.replace(/[០-៩]/g, (digit) => khmerNumerals[digit] ?? digit);
  const count = normalized.match(/(?:x|×)\s*(\d+)|\b(\d+)\s*(?:pcs|pieces|អាវ|ដុំ)?\b/i);
  if (count) return Math.max(1, Number(count[1] ?? count[2]) || 1);
  if (message.includes("ពីរ")) return 2;
  if (message.includes("បី")) return 3;
  return 1;
}

function parseColor(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("black") || normalized.includes("ពណ៌ខ្មៅ")) return "Black";
  if (normalized.includes("white") || normalized.includes("ពណ៌ស")) return "White";
  if (normalized.includes("blue") || normalized.includes("ពណ៌ខៀវ")) return "Blue";
  if (normalized.includes("gray") || normalized.includes("grey") || normalized.includes("ប្រផេះ")) return "Gray";
  if (normalized.includes("sand") || normalized.includes("ពណ៌ខ្សាច់")) return "Sand";
  return "";
}

function parseSize(message: string): string {
  const size = message.match(/\b(?:size\s*)?(XXL|XL|XS|S|M|L)\b/i);
  return size?.[1]?.toUpperCase() ?? "";
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const today = new Date();
  return (
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" }) ===
    today.toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" })
  );
}

function calculateCustomer(
  customer: Omit<Customer, "orders"> | Customer,
  orders: OrderRecord[],
): Customer {
  const history = orders.filter((order) => order.customerId === customer.id);
  const delivered = history.filter((order) => order.status === "Delivered").length;
  const cancelled = history.filter((order) =>
    ["Cancelled", "Failed Delivery", "Returned"].includes(order.status),
  ).length;
  const pending = history.filter(
    (order) =>
      !["Delivered", "Cancelled", "Failed Delivery", "Returned"].includes(
        order.status,
      ),
  ).length;
  const spent = history
    .filter((order) => order.status === "Delivered")
    .reduce((sum, order) => sum + order.total, 0);
  const completed = delivered + cancelled;
  const reliability = completed
    ? Math.round((delivered / completed) * 100)
    : customer.reliability;
  return {
    ...customer,
    totalOrders: history.length,
    delivered,
    cancelled,
    pending,
    totalSpent: spent,
    reliability,
    orders: history,
  };
}

router.get("/tenhflow/dashboard", async (_req, res): Promise<void> => {
  const currentOwner = ownerId(res);
  const orders = await listRecords<OrderRecord>(currentOwner, "order");
  const products = await listRecords<Product>(currentOwner, "product");
  const activeOrders = orders.filter((order) => order.status !== "Cancelled");
  const pipelineNames = [
    "New",
    "Confirmed",
    "Packing",
    "Ready",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];
  const last30Days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" });
    const dayOrders = activeOrders.filter(
      (order) =>
        new Date(order.createdAt).toLocaleDateString("en-CA", {
          timeZone: "Asia/Phnom_Penh",
        }) === key,
    );
    return {
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Phnom_Penh",
      }),
      revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
      orders: dayOrders.length,
    };
  });

  const productSales = new Map<string, number>();
  for (const order of activeOrders) {
    productSales.set(
      order.productCode,
      (productSales.get(order.productCode) ?? 0) + order.quantity,
    );
  }

  const dashboard = {
    todayOrders: activeOrders.filter((order) => isToday(order.createdAt)).length,
    revenue: activeOrders
      .filter((order) => isToday(order.createdAt))
      .reduce((sum, order) => sum + order.total, 0),
    pendingOrders: activeOrders.filter((order) =>
      ["New", "Confirmed", "Packing", "Ready"].includes(order.status),
    ).length,
    codPending: activeOrders
      .filter(
        (order) =>
          /cod|cash.?on.?delivery/i.test(order.paymentMethod) &&
          order.paid < order.total,
      )
      .reduce((sum, order) => sum + order.total - order.paid, 0),
    pipeline: pipelineNames.map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    })),
    sales: last30Days,
    topProducts: products
      .map((product) => ({
        code: product.code,
        name: product.name,
        sold: productSales.get(product.code) ?? 0,
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 3),
  };
  res.json(GetTenhflowDashboardResponse.parse(dashboard));
});

router.get("/tenhflow/activity", async (_req, res): Promise<void> => {
  const events = await listRecords<Activity>(ownerId(res), "activity");
  res.json(GetTenhflowActivityResponse.parse(events));
});

router.get("/tenhflow/captures", async (_req, res): Promise<void> => {
  const captures = await listRecords<Capture>(ownerId(res), "capture");
  res.json(ListCapturesResponse.parse(captures));
});

router.post("/tenhflow/captures", async (req, res): Promise<void> => {
  const parsed = CreateCaptureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const currentOwner = ownerId(res);
  const products = await listRecords<Product>(currentOwner, "product");
  const customers = await listRecords<Customer>(currentOwner, "customer");
  const settings = await getRecord<Settings>(currentOwner, "settings", "shop");
  const code = parsed.data.snippet.match(/\b[A-Z]\d{2,4}\b/i)?.[0]?.toUpperCase() ?? "";
  const product = products.find((item) => item.code.toUpperCase() === code);
  const existingCustomer = customers.find(
    (item) =>
      item.name.trim().toLowerCase() ===
      parsed.data.customerName.trim().toLowerCase(),
  );
  const color = parseColor(parsed.data.snippet);
  const size = parseSize(parsed.data.snippet);
  const quantity = parseQuantity(parsed.data.snippet);
  const confidence = product
    ? color && size
      ? 96
      : 74
    : 38;
  const capture: Capture = {
    id: `capture-${randomUUID()}`,
    customerName: existingCustomer?.name ?? parsed.data.customerName.trim(),
    customerId: existingCustomer?.id ?? null,
    snippet: parsed.data.snippet.trim(),
    channel: parsed.data.channel,
    status: "Ready to Order",
    productCode: product?.code ?? code,
    productName: product?.name ?? "Unknown product",
    color,
    size,
    quantity,
    unitPrice: product?.price ?? 0,
    deliveryFee: settings?.defaultDeliveryFee ?? 2,
    phone: existingCustomer?.phone || null,
    address: existingCustomer?.address || null,
    confidence,
    createdAt: new Date().toISOString(),
    missing: [],
  };
  capture.missing = missingCaptureFields(capture);
  capture.status =
    capture.missing.length === 0 ? "Ready to Order" : "Needs Review";
  await saveRecord(currentOwner, "capture", capture.id, capture);
  res.status(201).json(ListCapturesResponse.element.parse(capture));
});

router.patch("/tenhflow/captures/:id", async (req, res): Promise<void> => {
  const params = UpdateCaptureParams.safeParse(req.params);
  const body = UpdateCaptureBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid capture update" });
    return;
  }
  if (body.data.status?.toLowerCase() === "ordered") {
    res.status(400).json({ error: "Only order confirmation can mark a capture as ordered" });
    return;
  }
  const currentOwner = ownerId(res);
  const capture = await getRecord<Capture>(
    currentOwner,
    "capture",
    params.data.id,
  );
  if (!capture) {
    res.status(404).json({ error: "Capture not found" });
    return;
  }
  const updated = { ...capture, ...body.data };
  const products = await listRecords<Product>(currentOwner, "product");
  const product = products.find(
    (item) => item.code.toLowerCase() === updated.productCode.toLowerCase(),
  );
  if (product) {
    updated.productName = product.name;
    updated.unitPrice = product.price;
  }
  updated.missing = missingCaptureFields(updated);
  if (!body.data.status) {
    updated.status =
      updated.missing.length === 0 ? "Ready to Order" : "Needs Review";
  }
  await saveRecord(currentOwner, "capture", capture.id, updated);
  res.json(UpdateCaptureResponse.parse(updated));
});

router.post("/tenhflow/captures/:id/confirm", async (req, res): Promise<void> => {
  const params = ConfirmCaptureParams.safeParse(req.params);
  const body = ConfirmCaptureBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid order confirmation" });
    return;
  }
  const currentOwner = ownerId(res);
  const capture = await getRecord<Capture>(
    currentOwner,
    "capture",
    params.data.id,
  );
  if (!capture) {
    res.status(404).json({ error: "Capture not found" });
    return;
  }
  if (capture.status.toLowerCase() === "ordered") {
    res.status(409).json({ error: "This capture already has a confirmed order" });
    return;
  }
  const missing = missingCaptureFields(capture);
  if (missing.length) {
    res.status(400).json({ error: `Missing information: ${missing.join(", ")}` });
    return;
  }
  const products = await listRecords<Product>(currentOwner, "product");
  const product = products.find(
    (item) => item.code.toLowerCase() === capture.productCode.toLowerCase(),
  );
  if (!product || !product.active) {
    res.status(400).json({ error: `Unknown product code ${capture.productCode}` });
    return;
  }
  if (product.stock < capture.quantity) {
    res.status(400).json({ error: "Not enough stock for this order" });
    return;
  }

  let customer = capture.customerId
    ? await getRecord<Customer>(currentOwner, "customer", capture.customerId)
    : undefined;
  if (!customer) {
    const newCustomerId = `customer-${randomUUID()}`;
    customer = {
      id: newCustomerId,
      name: capture.customerName,
      phone: capture.phone ?? "",
      address: capture.address ?? "",
      platform: capture.channel,
      since: new Date().toISOString().slice(0, 10),
      totalOrders: 0,
      delivered: 0,
      cancelled: 0,
      pending: 0,
      totalSpent: 0,
      reliability: 100,
      notes: "",
      orders: [],
    };
    await saveRecord(currentOwner, "customer", newCustomerId, customer);
  } else {
    customer = {
      ...customer,
      name: capture.customerName,
      phone: capture.phone ?? customer.phone,
      address: capture.address ?? customer.address,
    };
    await saveRecord(currentOwner, "customer", customer.id, customer);
  }

  const existingOrders = await listRecords<OrderRecord>(currentOwner, "order");
  const largestOrderNumber = existingOrders.reduce((highest, order) => {
    const number = Number(order.id.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(highest, number);
  }, 10479);
  const orderId = `ORD-${largestOrderNumber + 1}`;
  const subtotal = product.price * capture.quantity;
  const total = subtotal + capture.deliveryFee;
  const order: OrderRecord = {
    id: orderId,
    customerId: customer.id,
    customerName: customer.name,
    phone: capture.phone ?? customer.phone,
    address: capture.address ?? customer.address,
    productCode: product.code,
    productName: product.name,
    color: capture.color,
    size: capture.size,
    quantity: capture.quantity,
    subtotal,
    deliveryFee: capture.deliveryFee,
    total,
    paymentMethod: body.data.paymentMethod,
    paymentStatus: "Pending",
    paid: 0,
    deliveryMethod: body.data.deliveryMethod,
    rider: null,
    deliveryStatus: "Pending",
    status: "New",
    channel: capture.channel,
    createdAt: new Date().toISOString(),
  };

  await saveRecord(currentOwner, "order", order.id, order);
  await saveRecord(currentOwner, "product", product.id, {
    ...product,
    stock: product.stock - capture.quantity,
  });
  await saveRecord(currentOwner, "capture", capture.id, {
    ...capture,
    status: "Ordered",
  });
  const eventId = `activity-${randomUUID()}`;
  await saveRecord(currentOwner, "activity", eventId, {
    id: eventId,
    title: `${customer.name}'s order was confirmed`,
    detail: `${order.id} · ${order.productCode} ${order.color} ${order.size} ×${order.quantity}`,
    time: "Just now",
    channel: "order",
  });
  res.status(201).json(ConfirmCaptureResponse.parse(order));
});

router.get("/tenhflow/orders", async (_req, res): Promise<void> => {
  const orders = await listRecords<OrderRecord>(ownerId(res), "order");
  res.json(ListOrdersResponse.parse(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
});

router.get("/tenhflow/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = await getRecord<OrderRecord>(ownerId(res), "order", params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(GetOrderResponse.parse(order));
});

router.patch("/tenhflow/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  const body = UpdateOrderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid order update" });
    return;
  }
  const currentOwner = ownerId(res);
  const order = await getRecord<OrderRecord>(currentOwner, "order", params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const updated: OrderRecord = { ...order, ...body.data };
  if (body.data.paymentStatus) {
    const paymentStatus = body.data.paymentStatus.toLowerCase();
    if (paymentStatus === "paid" && body.data.paid === undefined) {
      updated.paid = updated.total;
    } else if (
      ["pending", "unpaid"].includes(paymentStatus) &&
      body.data.paid === undefined
    ) {
      updated.paid = 0;
    }
  }
  if (body.data.deliveryStatus?.toLowerCase() === "delivered") {
    updated.status = "Delivered";
  } else if (body.data.deliveryStatus?.toLowerCase() === "out for delivery") {
    updated.status = "Out for Delivery";
  } else if (body.data.deliveryStatus?.toLowerCase() === "failed") {
    updated.status = "Failed Delivery";
  } else if (body.data.status?.toLowerCase() === "delivered") {
    updated.deliveryStatus = "Delivered";
  } else if (body.data.status?.toLowerCase() === "out for delivery") {
    updated.deliveryStatus = "Out for Delivery";
  } else if (body.data.status?.toLowerCase() === "failed delivery") {
    updated.deliveryStatus = "Failed";
  }
  await saveRecord(currentOwner, "order", order.id, updated);
  res.json(UpdateOrderResponse.parse(updated));
});

async function customerList(currentOwner: string): Promise<Customer[]> {
  const customers = await listRecords<Customer>(currentOwner, "customer");
  const orders = await listRecords<OrderRecord>(currentOwner, "order");
  return customers.map((customer) => calculateCustomer(customer, orders));
}

router.get("/tenhflow/customers", async (_req, res): Promise<void> => {
  const customers = await customerList(ownerId(res));
  res.json(ListCustomersResponse.parse(customers));
});

router.post("/tenhflow/customers", async (req, res): Promise<void> => {
  const body = CreateCustomerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentOwner = ownerId(res);
  const customers = await listRecords<Customer>(currentOwner, "customer");
  const phone = body.data.phone.replace(/\D/g, "");
  const existing = customers.find(
    (customer) => customer.phone.replace(/\D/g, "") === phone && phone !== "",
  );
  if (existing) {
    const orders = await listRecords<OrderRecord>(currentOwner, "order");
    res.status(200).json(CreateCustomerResponse.parse(calculateCustomer(existing, orders)));
    return;
  }
  const customer: Customer = {
    id: `customer-${randomUUID()}`,
    ...body.data,
    since: new Date().toISOString().slice(0, 10),
    totalOrders: 0,
    delivered: 0,
    cancelled: 0,
    pending: 0,
    totalSpent: 0,
    reliability: 100,
    orders: [],
  };
  await saveRecord(currentOwner, "customer", customer.id, customer);
  res.status(201).json(CreateCustomerResponse.parse(customer));
});

router.get("/tenhflow/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const currentOwner = ownerId(res);
  const customer = await getRecord<Customer>(currentOwner, "customer", params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const orders = await listRecords<OrderRecord>(currentOwner, "order");
  res.json(GetCustomerResponse.parse(calculateCustomer(customer, orders)));
});

router.patch("/tenhflow/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid customer update" });
    return;
  }
  const currentOwner = ownerId(res);
  const customer = await getRecord<Customer>(currentOwner, "customer", params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const updated = { ...customer, ...body.data };
  await saveRecord(currentOwner, "customer", customer.id, updated);
  const orders = await listRecords<OrderRecord>(currentOwner, "order");
  res.json(UpdateCustomerResponse.parse(calculateCustomer(updated, orders)));
});

router.get("/tenhflow/products", async (_req, res): Promise<void> => {
  const products = await listRecords<Product>(ownerId(res), "product");
  res.json(ListProductsResponse.parse(products));
});

router.post("/tenhflow/products", async (req, res): Promise<void> => {
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentOwner = ownerId(res);
  const products = await listRecords<Product>(currentOwner, "product");
  if (products.some((product) => product.code.toLowerCase() === body.data.code.toLowerCase())) {
    res.status(409).json({ error: "That product code is already in use" });
    return;
  }
  const product: Product = { id: `product-${randomUUID()}`, ...body.data, active: true };
  await saveRecord(currentOwner, "product", product.id, product);
  res.status(201).json(CreateProductResponse.parse(product));
});

router.patch("/tenhflow/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid product update" });
    return;
  }
  const currentOwner = ownerId(res);
  const product = await getRecord<Product>(currentOwner, "product", params.data.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (
    body.data.code &&
    (await listRecords<Product>(currentOwner, "product")).some(
      (item) =>
        item.id !== product.id &&
        item.code.toLowerCase() === body.data.code?.toLowerCase(),
    )
  ) {
    res.status(409).json({ error: "That product code is already in use" });
    return;
  }
  const updated = { ...product, ...body.data };
  await saveRecord(currentOwner, "product", product.id, updated);
  res.json(UpdateProductResponse.parse(updated));
});

router.get("/tenhflow/delivery", async (_req, res): Promise<void> => {
  const orders = await listRecords<OrderRecord>(ownerId(res), "order");
  const deliveries = orders.map((order) => ({
    id: order.id,
    orderId: order.id,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    method: order.deliveryMethod,
    fee: order.deliveryFee,
    rider: order.rider,
    status: order.deliveryStatus,
  }));
  res.json(ListDeliveriesResponse.parse(deliveries));
});

router.patch("/tenhflow/delivery/:id", async (req, res): Promise<void> => {
  const params = UpdateDeliveryParams.safeParse(req.params);
  const body = UpdateDeliveryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid delivery update" });
    return;
  }
  const currentOwner = ownerId(res);
  const order = await getRecord<OrderRecord>(currentOwner, "order", params.data.id);
  if (!order) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  const status = body.data.status ?? order.deliveryStatus;
  const updated: OrderRecord = {
    ...order,
    deliveryMethod: body.data.method ?? order.deliveryMethod,
    rider: body.data.rider === undefined ? order.rider : body.data.rider,
    deliveryStatus: status,
    ...(status === "Delivered" ? { status: "Delivered" } : {}),
    ...(status === "Failed" ? { status: "Failed Delivery" } : {}),
  };
  await saveRecord(currentOwner, "order", order.id, updated);
  res.json(
    UpdateDeliveryResponse.parse({
      id: updated.id,
      orderId: updated.id,
      customerName: updated.customerName,
      phone: updated.phone,
      address: updated.address,
      method: updated.deliveryMethod,
      fee: updated.deliveryFee,
      rider: updated.rider,
      status: updated.deliveryStatus,
    }),
  );
});

router.get("/tenhflow/payments", async (_req, res): Promise<void> => {
  const orders = await listRecords<OrderRecord>(ownerId(res), "order");
  const payments = orders.map((order) => ({
    id: order.id,
    orderId: order.id,
    customerName: order.customerName,
    method: order.paymentMethod,
    total: order.total,
    paid: order.paid,
    remaining: Math.max(0, order.total - order.paid),
    status: order.paymentStatus,
    createdAt: order.createdAt,
  }));
  res.json(ListPaymentsResponse.parse(payments));
});

router.patch("/tenhflow/payments/:id", async (req, res): Promise<void> => {
  const params = UpdatePaymentParams.safeParse(req.params);
  const body = UpdatePaymentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid payment update" });
    return;
  }
  const currentOwner = ownerId(res);
  const order = await getRecord<OrderRecord>(currentOwner, "order", params.data.id);
  if (!order) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const paid = Math.min(body.data.paid ?? order.paid, order.total);
  const status =
    body.data.status ??
    (paid >= order.total ? "Paid" : paid > 0 ? "Partial" : "Pending");
  const updated = {
    ...order,
    paid,
    paymentStatus: status,
    paymentMethod: body.data.method ?? order.paymentMethod,
  };
  await saveRecord(currentOwner, "order", order.id, updated);
  res.json(
    UpdatePaymentResponse.parse({
      id: updated.id,
      orderId: updated.id,
      customerName: updated.customerName,
      method: updated.paymentMethod,
      total: updated.total,
      paid: updated.paid,
      remaining: Math.max(0, updated.total - updated.paid),
      status: updated.paymentStatus,
      createdAt: updated.createdAt,
    }),
  );
});

router.get("/tenhflow/inbox", async (_req, res): Promise<void> => {
  const conversations = await listRecords<Conversation>(ownerId(res), "conversation");
  res.json(ListConversationsResponse.parse(conversations));
});

router.patch("/tenhflow/inbox/:id", async (req, res): Promise<void> => {
  const params = UpdateConversationParams.safeParse(req.params);
  const body = UpdateConversationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid conversation update" });
    return;
  }
  const currentOwner = ownerId(res);
  const conversation = await getRecord<Conversation>(
    currentOwner,
    "conversation",
    params.data.id,
  );
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const updated = { ...conversation, ...body.data };
  await saveRecord(currentOwner, "conversation", conversation.id, updated);
  res.json(UpdateConversationResponse.parse(updated));
});

router.get("/tenhflow/settings", async (_req, res): Promise<void> => {
  const settings = await getRecord<Settings>(ownerId(res), "settings", "shop");
  if (!settings) {
    res.status(404).json({ error: "Shop settings not found" });
    return;
  }
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/tenhflow/settings", async (req, res): Promise<void> => {
  const body = UpdateSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const currentOwner = ownerId(res);
  const settings = await getRecord<Settings>(currentOwner, "settings", "shop");
  if (!settings) {
    res.status(404).json({ error: "Shop settings not found" });
    return;
  }
  const updated: Settings = { ...settings, ...body.data };
  await saveRecord(currentOwner, "settings", "shop", updated);
  res.json(UpdateSettingsResponse.parse(updated));
});

export default router;
