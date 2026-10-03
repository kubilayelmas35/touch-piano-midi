/**
 * Paylaşılan CMS mantığı — webMethod ve HTTP uçları burayı kullanır.
 */
import wixData from "wix-data";
import { currentMember } from "wix-members-backend";

export const COLLECTION = "UserPianoData";

const DATA_OPTS = { suppressAuth: true };

export function formatError(where, err) {
  const msg = err?.message || String(err);
  if (msg.includes("WDE0027") || msg.includes("WDE0177") || msg.includes("permission")) {
    return `CMS izin hatası (${COLLECTION}). Üyeler için Create/Update açın. Detay: ${msg}`;
  }
  if (msg.includes("WDE0007") || msg.toLowerCase().includes("not found")) {
    return `CMS koleksiyonu yok: "${COLLECTION}". CMS'te bu ID ile koleksiyon oluşturun.`;
  }
  return `${where}: ${msg}`;
}

export async function requireMemberId() {
  const member = await currentMember.getMember();
  if (!member?._id) {
    throw new Error("Üye girişi gerekli. Wix sitesinde giriş yapın.");
  }
  return member._id;
}

export async function loadLibraries(memberId) {
  const result = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find(DATA_OPTS);

  if (!result.items.length) {
    return { libraries: [] };
  }

  const row = result.items[0];
  const raw =
    typeof row.librariesJson === "string"
      ? JSON.parse(row.librariesJson)
      : row.librariesJson;

  if (raw && Array.isArray(raw.libraries)) {
    return { libraries: raw.libraries };
  }
  if (Array.isArray(raw)) {
    return { libraries: raw };
  }
  return { libraries: [] };
}

export async function saveLibraries(memberId, libraries) {
  if (!Array.isArray(libraries)) {
    throw new Error("libraries dizi olmalı");
  }

  const librariesJson = JSON.stringify({ libraries });
  const existing = await wixData
    .query(COLLECTION)
    .eq("memberId", memberId)
    .limit(1)
    .find(DATA_OPTS);

  if (existing.items.length) {
    await wixData.update(
      COLLECTION,
      {
        _id: existing.items[0]._id,
        memberId,
        librariesJson,
      },
      DATA_OPTS
    );
  } else {
    await wixData.insert(COLLECTION, { memberId, librariesJson }, DATA_OPTS);
  }
}
