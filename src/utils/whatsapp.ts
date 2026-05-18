import type { OrderServiceType } from "@/services/orderService";
import { RK_STUDIO } from "@/utils/constants";

type SendToWhatsAppInput = {
  name: string;
  phone: string;
  service: OrderServiceType;
  details: string | string[];
};

type ApprovalStatus = "pending" | "accepted" | "rejected";

type AdminOrderWhatsAppInput = {
  phone: string;
  items: string[];
  total: number;
};

type UserApprovalWhatsAppInput = {
  phone: string;
  status: ApprovalStatus;
};

const WHATSAPP_NUMBER = RK_STUDIO.whatsappNumber;

const buildOrderMessage = ({ name, phone, service, details }: SendToWhatsAppInput) => {
  const detailLines = Array.isArray(details) ? details : [`Details: ${details}`];

  return [
    "Hello RK Studio,",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${service}`,
    `City: ${RK_STUDIO.city}`,
    ...detailLines,
    "Please confirm my order details.",
  ].join("\n");
};

const appendMessageToChatUrl = (chatUrl: string, message: string) => {
  try {
    const url = new URL(chatUrl);
    url.searchParams.set("text", message);
    return url.toString();
  } catch {
    const separator = chatUrl.includes("?") ? "&" : "?";
    return `${chatUrl}${separator}text=${encodeURIComponent(message)}`;
  }
};

export const buildWhatsAppUrl = (input: SendToWhatsAppInput) => {
  const message = buildOrderMessage(input);

  if (WHATSAPP_NUMBER) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  if (RK_STUDIO.whatsappChatUrl) {
    return appendMessageToChatUrl(RK_STUDIO.whatsappChatUrl, message);
  }

  return "";
};

export const sendToWhatsApp = (input: SendToWhatsAppInput) => {
  if (typeof window === "undefined") {
    return false;
  }

  const url = buildWhatsAppUrl(input);

  if (!url) {
    return false;
  }

  window.location.href = url;
  return true;
};

const sanitizePhone = (phone: string) => phone.replace(/\D/g, "");

export const buildAdminOrderWhatsAppUrl = (input: AdminOrderWhatsAppInput) => {
  const adminPhone = RK_STUDIO.adminPhone || RK_STUDIO.whatsappNumber;

  if (!adminPhone) {
    return "";
  }

  const normalizedOrderPhone = sanitizePhone(input.phone);
  const itemsText = input.items.length > 0 ? input.items.join(", ") : "Not specified";
  const message = [
    "New Order Received",
    `Phone: ${normalizedOrderPhone}`,
    `Items: ${itemsText}`,
    `Total: INR ${Math.round(input.total)}`,
  ].join("\n");

  return `https://wa.me/${sanitizePhone(adminPhone)}?text=${encodeURIComponent(message)}`;
};

export const buildUserOrderDecisionWhatsAppUrl = (input: UserApprovalWhatsAppInput) => {
  const normalizedPhone = sanitizePhone(input.phone);

  if (!normalizedPhone) {
    return "";
  }

  let message = "";

  if (input.status === "accepted") {
    message = "Your order has been accepted. We will start processing it soon.";
  }

  if (input.status === "rejected") {
    message = "Your order has been declined. Please contact support for details.";
  }

  if (!message) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};

export const openWhatsAppInNewTab = (url: string) => {
  if (typeof window === "undefined" || !url) {
    return false;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  return true;
};

export const openWhatsAppOrder = ({
  name,
  phone,
  service,
  selectedService,
}: {
  name: string;
  phone: string;
  service: OrderServiceType;
  selectedService: string;
}) => {
  sendToWhatsApp({
    name,
    phone,
    service,
    details: selectedService,
  });
};
