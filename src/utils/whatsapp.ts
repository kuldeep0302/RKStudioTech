import type { OrderServiceType } from "@/services/orderService";
import { RK_STUDIO } from "@/utils/constants";

type SendToWhatsAppInput = {
  name: string;
  phone: string;
  service: OrderServiceType;
  details: string | string[];
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

  window.open(url, "_blank", "noopener,noreferrer");
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
