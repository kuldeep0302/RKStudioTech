export type ProductCategory = "fabric" | "dupatta";

export type Product = {
  id: string;
  name: string;
  price: number;
  productType: "fabric" | "piece";
  image: string;
  type: string;
  description?: string;
  category: ProductCategory;
  inStock?: boolean;
  tag?: string;
  suggestion?: string;
  discountPercent?: number;
  rating?: number;
};

export type ServiceCategory = {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
};

export const serviceCategories: ServiceCategory[] = [
  {
    id: "tailoring",
    title: "Tailoring",
    description: "Ladies aur gents silai, fitting aur custom design.",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    href: "/tailoring",
  },
  {
    id: "fabric",
    title: "Fabric",
    description: "Premium cotton, rayon, silk blend aur festive options.",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    href: "/fabric",
  },
  {
    id: "dupatta",
    title: "Dupatta",
    description: "Daily wear se shaadi collection tak stylish dupatte.",
    image:
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=80",
    href: "/dupatta",
  },
];

export const fabricProducts: Product[] = [
  {
    id: "fab-1",
    name: "Soft Cotton Floral",
    price: 950,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    type: "cotton",
    description: "Lightweight cotton for daily wear suits.",
    category: "fabric",
    inStock: true,
    tag: "daily wear",
    discountPercent: 10,
    rating: 4.4,
  },
  {
    id: "fab-2",
    name: "Rayon Printed Premium",
    price: 1350,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    type: "rayon",
    description: "Flowy rayon fabric for kurti sets.",
    category: "fabric",
    inStock: true,
    tag: "popular",
    discountPercent: 15,
    rating: 4.6,
  },
  {
    id: "fab-3",
    name: "Silk Blend Festive",
    price: 2890,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    type: "silk",
    description: "Rich silk blend for festive and wedding wear.",
    category: "fabric",
    inStock: true,
    tag: "festive",
    discountPercent: 20,
    rating: 4.8,
  },
  {
    id: "fab-4",
    name: "Linen Comfort",
    price: 1750,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
    type: "linen",
    description: "Breathable linen for smart casual outfits.",
    category: "fabric",
    inStock: false,
    tag: "premium",
    discountPercent: 12,
    rating: 4.2,
  },
  {
    id: "fab-5",
    name: "Cotton Handblock",
    price: 1220,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    type: "cotton",
    description: "Handblock-inspired print for classic looks.",
    category: "fabric",
    inStock: true,
    tag: "handblock",
    discountPercent: 8,
    rating: 4.3,
  },
  {
    id: "fab-6",
    name: "Rayon Party Texture",
    price: 2480,
    productType: "fabric",
    image:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
    type: "rayon",
    description: "Textured rayon for evening wear.",
    category: "fabric",
    inStock: true,
    tag: "party",
    discountPercent: 18,
    rating: 4.7,
  },
];

export const dupattaProducts: Product[] = [
  {
    id: "dup-1",
    name: "Ready Suit - Chiffon Ombre",
    price: 790,
    productType: "piece",
    image:
      "https://images.unsplash.com/photo-1594633313593-bab3825d0caf?auto=format&fit=crop&w=900&q=80",
    type: "chiffon",
    description: "Ready-to-wear suit set.",
    category: "dupatta",
    inStock: true,
    tag: "trending",
    suggestion: "Best with pastel straight kurti",
    discountPercent: 12,
    rating: 4.5,
  },
  {
    id: "dup-2",
    name: "Ready Suit - Bandhani Cotton",
    price: 980,
    productType: "piece",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    type: "cotton",
    description: "Everyday ready suit with bandhani inspired style.",
    category: "dupatta",
    inStock: true,
    tag: "daily wear",
    suggestion: "Match with plain white kurti",
    discountPercent: 10,
    rating: 4.4,
  },
  {
    id: "dup-3",
    name: "Designer Silk Festive Suit",
    price: 1850,
    productType: "piece",
    image:
      "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=900&q=80",
    type: "silk",
    description: "Premium ready-made festive suit.",
    category: "dupatta",
    inStock: true,
    tag: "festive",
    suggestion: "Great with gold-tone anarkali",
    discountPercent: 22,
    rating: 4.9,
  },
  {
    id: "dup-4",
    name: "Georgette Mirror Work Suit",
    price: 1490,
    productType: "piece",
    image:
      "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=900&q=80",
    type: "georgette",
    description: "Ready-to-wear party suit with mirror-work touch.",
    category: "dupatta",
    inStock: false,
    tag: "party",
    suggestion: "Pair with solid black kurti",
    discountPercent: 14,
    rating: 4.1,
  },
];
