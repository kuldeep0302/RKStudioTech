const envWhatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const envAdminPhone = (process.env.NEXT_PUBLIC_ADMIN_PHONE || "").replace(/\D/g, "");
const envWhatsappChannelUrl = process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_URL || "";
const defaultWhatsappMessage = "Hello RK Studio, mujhe silai / kapda ke bare me jankari chahiye.";
const parseAmount = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const tailoringAdvanceMin = parseAmount(process.env.NEXT_PUBLIC_TAILORING_ADVANCE_MIN, 100);
const tailoringAdvanceMax = parseAmount(process.env.NEXT_PUBLIC_TAILORING_ADVANCE_MAX, 300);
const tailoringAdvanceDefault = Math.min(
  tailoringAdvanceMax,
  Math.max(tailoringAdvanceMin, parseAmount(process.env.NEXT_PUBLIC_TAILORING_ADVANCE_DEFAULT, 100)),
);

export const RK_STUDIO = {
  name: "RK Studio",
  city: "Narnaul",
  state: "Haryana",
  pinCode: "123001",
  servingText: "Narnaul (123001) me seva",
  homeVisitText: "Ghar aakar service milegi",
  whatsappNumber: envWhatsappNumber,
  whatsappDisplay: process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY || (envWhatsappNumber ? `+${envWhatsappNumber}` : ""),
  whatsappChatUrl:
    process.env.NEXT_PUBLIC_WHATSAPP_CHAT_URL
    || (envWhatsappNumber ? `https://wa.me/${envWhatsappNumber}?text=${encodeURIComponent(defaultWhatsappMessage)}` : "")
    || envWhatsappChannelUrl,
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
  whatsappChannelUrl: envWhatsappChannelUrl,
  adminPhone: envAdminPhone,
  payment: {
    currency: "INR",
    tailoringAdvanceMin,
    tailoringAdvanceMax,
    tailoringAdvanceDefault,
    upiId: process.env.NEXT_PUBLIC_UPI_ID || "",
    upiPayeeName: process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "RK Studio",
  },
};
