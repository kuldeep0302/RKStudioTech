import { addDoc, collection, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { seedDummyProducts } from "@/services/productService";
import { getFirebaseDb } from "@/services/firebase";
import { RK_STUDIO } from "@/utils/constants";

type SeedSummary = {
  productsAdded: number;
  usersAdded: number;
  ordersAdded: number;
};

const defaultAdminPhone = "918901501572";

const getSeedAdminPhone = () => {
  const fromEnv = RK_STUDIO.adminPhone?.replace(/\D/g, "") || "";
  return fromEnv || defaultAdminPhone;
};

export const seedUsersIfEmpty = async (): Promise<{ usersAdded: number; seedUserId: string | null }> => {
  const db = getFirebaseDb();

  if (!db) {
    return { usersAdded: 0, seedUserId: null };
  }

  const usersRef = collection(db, "users");
  const usersSnapshot = await getDocs(usersRef);

  if (!usersSnapshot.empty) {
    return { usersAdded: 0, seedUserId: usersSnapshot.docs[0].id };
  }

  const adminPhone = getSeedAdminPhone();
  const userDoc = await addDoc(usersRef, {
    phone: adminPhone,
    role: "admin",
    name: "Owner",
    savedFabricIds: [],
    createdAt: serverTimestamp(),
  });

  return { usersAdded: 1, seedUserId: userDoc.id };
};

export const seedOrdersIfEmpty = async (seedUserId?: string | null): Promise<number> => {
  const db = getFirebaseDb();

  if (!db) {
    return 0;
  }

  const ordersRef = collection(db, "orders");
  const ordersSnapshot = await getDocs(ordersRef);

  if (!ordersSnapshot.empty) {
    return 0;
  }

  let userId = seedUserId || "";

  if (!userId) {
    const usersSnapshot = await getDocs(collection(db, "users"));
    userId = usersSnapshot.docs[0]?.id || "seed-user";
  }

  await addDoc(ordersRef, {
    userId,
    phone: getSeedAdminPhone(),
    items: ["Red Dupatta"],
    total: 299,
    service: "dupatta",
    orderDetails: {
      item: "Red Dupatta",
      items: ["Red Dupatta"],
      total_price: 299,
      note: "Auto-seeded sample order",
    },
    paymentStatus: "pending",
    paymentType: "full",
    amountPaid: 0,
    advanceAmount: 0,
    remainingAmount: 299,
    finalPrice: 299,
    finalPayable: 299,
    totalPrice: 299,
    status: "pending",
    approvalStatus: "pending",
    statusHistory: [
      {
        status: "pending",
        note: "Seeded order",
        updatedBy: "system",
        updatedAt: Timestamp.now(),
      },
    ],
    createdAt: serverTimestamp(),
  });

  return 1;
};

export const ensureAdminBootstrapData = async (): Promise<SeedSummary> => {
  const productsAdded = await seedDummyProducts();
  const { usersAdded, seedUserId } = await seedUsersIfEmpty();
  const ordersAdded = await seedOrdersIfEmpty(seedUserId);

  return {
    productsAdded,
    usersAdded,
    ordersAdded,
  };
};
