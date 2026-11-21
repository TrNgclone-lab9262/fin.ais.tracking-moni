import {
  HandoverChecklistItem,
  InteriorCatalogKey,
  InteriorDesignScenario,
  InteriorFurnitureItem,
  InteriorMaterialFinish,
  InteriorMepPoint,
  InteriorMepPointKind,
  InteriorStudioState,
  InteriorStylePreset,
} from "@/types/finance";

export interface RoomZoneSpec {
  id: string;
  code: string; // '01'..'08'
  name: string;
  shortName: string;
  x: number; // tâm X (mét)
  z: number; // tâm Z (mét)
  width: number;
  depth: number;
  ceilingHeight: number;
  floorMaterial: "CHANGYIH_TILE" | "WOOD_TILE" | "BATH_MARBLE" | "LOGGIA_GREY";
  developerNote: string;
}

export interface WallSegmentSpec {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number;
  height: number;
  cutawaySide?: "SOUTH" | "EAST" | "WEST" | "NORTH" | "INTERIOR";
  isCurvedCorner?: boolean;
}

export interface DoorSwingArcSpec {
  hingeX: number;
  hingeZ: number;
  radius: number;
  startAngleDeg: number; // 0 = +X, 90 = +Z (SVG screen coords)
  endAngleDeg: number;
}

export interface OpeningSpec {
  id: string;
  kind: "MAIN_DOOR" | "SLIDING_BALCONY" | "WINDOW" | "INTERIOR_DOOR" | "LOGGIA_DOOR" | "WC_WINDOW";
  label: string;
  wallId?: string;
  x: number;
  z: number;
  width: number;
  height: number;
  sillHeight: number;
  rotationY: number;
  swingArc?: DoorSwingArcSpec;
}

export interface StylePalettePreset {
  id: InteriorStylePreset;
  name: string;
  subtitle: string;
  wallColor: string;
  ceilingColor: string;
  livingTileColor: string;
  woodFloorColor: string;
  primaryWoodHex: string;
  secondaryWoodHex: string;
  fabricHex: string;
  accentHex: string;
  metalHex: string;
  canvasBgLight: string;
  canvasBgDark: string;
}

export const INTERIOR_STYLE_PRESETS: Record<InteriorStylePreset, StylePalettePreset> = {
  MODERN_WARM: {
    id: "MODERN_WARM",
    name: "Modern Warm",
    subtitle: "Gỗ sồi ấm · Kem sáng · Năng động hiện đại",
    wallColor: "#F5F1EA",
    ceilingColor: "#FAF8F4",
    livingTileColor: "#EBE6DC",
    woodFloorColor: "#B78352",
    primaryWoodHex: "#BA8756",
    secondaryWoodHex: "#7A573B",
    fabricHex: "#DDD3C5",
    accentHex: "#C27D4B",
    metalHex: "#44403C",
    canvasBgLight: "#EFECE6",
    canvasBgDark: "#171A21",
  },
  JAPANDI: {
    id: "JAPANDI",
    name: "Japandi Ấm Áp",
    subtitle: "Gỗ sáng tự nhiên · Vải lanh · Tối giản tĩnh lặng",
    wallColor: "#F4F0E8",
    ceilingColor: "#F9F7F2",
    livingTileColor: "#E8E2D5",
    woodFloorColor: "#C59B6D",
    primaryWoodHex: "#CAA374",
    secondaryWoodHex: "#8C6D4F",
    fabricHex: "#E2DACB",
    accentHex: "#8FA38D",
    metalHex: "#57534E",
    canvasBgLight: "#EDE9E0",
    canvasBgDark: "#191B1E",
  },
  MINIMALIST_SLATE: {
    id: "MINIMALIST_SLATE",
    name: "Minimalist Calm Slate",
    subtitle: "Trắng tinh khiết · Gỗ óc chó · Xám kiến trúc",
    wallColor: "#F3F5F8",
    ceilingColor: "#F8FAFC",
    livingTileColor: "#E5E9F0",
    woodFloorColor: "#9E7856",
    primaryWoodHex: "#8A6649",
    secondaryWoodHex: "#475569",
    fabricHex: "#CBD5E1",
    accentHex: "#2563EB",
    metalHex: "#334155",
    canvasBgLight: "#EAEEF4",
    canvasBgDark: "#0F172A",
  },
  WARM_SCANDINAVIAN: {
    id: "WARM_SCANDINAVIAN",
    name: "Warm Scandinavian",
    subtitle: "Gỗ bạch dương · Xanh xô thơm · Rất thoáng sáng",
    wallColor: "#F7F6F2",
    ceilingColor: "#FFFFFF",
    livingTileColor: "#ECEAE4",
    woodFloorColor: "#C8A47E",
    primaryWoodHex: "#D1B089",
    secondaryWoodHex: "#9A7B5C",
    fabricHex: "#DCE2DC",
    accentHex: "#5B7B6B",
    metalHex: "#52525B",
    canvasBgLight: "#F0EFEA",
    canvasBgDark: "#181B20",
  },
};

export const MATERIAL_FINISH_META: Record<
  InteriorMaterialFinish,
  { label: string; hex: string; roughness: number; metalness: number }
> = {
  WARM_OAK: { label: "Gỗ sồi ấm", hex: "#BA8756", roughness: 0.62, metalness: 0.04 },
  LIGHT_WALNUT: { label: "Gỗ óc chó", hex: "#765338", roughness: 0.58, metalness: 0.05 },
  CREAM_BOUCLE: { label: "Vải Bouclé kem", hex: "#E4DDD2", roughness: 0.92, metalness: 0.0 },
  SAGE_LINEN: { label: "Vải Linen xanh xô", hex: "#9BA896", roughness: 0.88, metalness: 0.0 },
  MATTE_CREAM: { label: "Laminate kem mờ", hex: "#F2EDE4", roughness: 0.42, metalness: 0.05 },
  CHARCOAL_SLATE: { label: "Xám than hiện đại", hex: "#3B4252", roughness: 0.45, metalness: 0.15 },
  WHITE_MARBLE: { label: "Đá vân mây trắng", hex: "#F1F3F5", roughness: 0.22, metalness: 0.08 },
  BRUSHED_TITANIUM: { label: "Kim loại xước", hex: "#64748B", roughness: 0.26, metalness: 0.85 },
};

/**
 * Bảng đồng bộ màu hoàn thiện đồ nội thất khi người dùng bấm nút 1 chạm
 * "Áp màu cho toàn bộ đồ" theo Phong cách thiết kế (Style Preset).
 */
export const STYLE_PRESET_FURNITURE_PALETTES: Record<
  InteriorStylePreset,
  {
    wood: InteriorMaterialFinish;
    cabinet: InteriorMaterialFinish;
    fabricPrimary: InteriorMaterialFinish;
    fabricAccent: InteriorMaterialFinish;
    chairTech: InteriorMaterialFinish;
    tableTop: InteriorMaterialFinish;
  }
> = {
  MODERN_WARM: {
    wood: "WARM_OAK",
    cabinet: "MATTE_CREAM",
    fabricPrimary: "CREAM_BOUCLE",
    fabricAccent: "SAGE_LINEN",
    chairTech: "CHARCOAL_SLATE",
    tableTop: "WARM_OAK",
  },
  JAPANDI: {
    wood: "WARM_OAK",
    cabinet: "MATTE_CREAM",
    fabricPrimary: "CREAM_BOUCLE",
    fabricAccent: "SAGE_LINEN",
    chairTech: "LIGHT_WALNUT",
    tableTop: "WARM_OAK",
  },
  MINIMALIST_SLATE: {
    wood: "LIGHT_WALNUT",
    cabinet: "CHARCOAL_SLATE",
    fabricPrimary: "CHARCOAL_SLATE",
    fabricAccent: "CREAM_BOUCLE",
    chairTech: "CHARCOAL_SLATE",
    tableTop: "WHITE_MARBLE",
  },
  WARM_SCANDINAVIAN: {
    wood: "WARM_OAK",
    cabinet: "MATTE_CREAM",
    fabricPrimary: "SAGE_LINEN",
    fabricAccent: "CREAM_BOUCLE",
    chairTech: "CREAM_BOUCLE",
    tableTop: "WHITE_MARBLE",
  },
};

export function resolveFinishForStylePreset(
  item: InteriorFurnitureItem,
  preset: InteriorStylePreset
): InteriorMaterialFinish {
  if (item.source === "DEVELOPER_INCLUDED") return item.materialFinish;
  const pal = STYLE_PRESET_FURNITURE_PALETTES[preset];
  switch (item.catalogKey) {
    case "sofa_3seat":
    case "accent_armchair":
      return pal.fabricPrimary;
    case "reading_lounge_chair":
    case "area_rug":
      return pal.fabricAccent;
    case "ergonomic_chair":
      return pal.chairTech;
    case "wardrobe_tall":
    case "wardrobe_compact":
    case "shoe_cabinet_tall":
    case "pegboard_goal_wall":
      return pal.cabinet;
    case "coffee_table":
      return pal.tableTop;
    case "tv_console_slat":
    case "dining_set_4":
    case "bed_master_160":
    case "bed_compact_140":
    case "nightstand":
    case "dual_workstation_desk":
    case "single_desk":
    case "tall_bookshelf_led":
      return pal.wood;
    default:
      return item.materialFinish;
  }
}

export const MEP_KIND_META: Record<
  InteriorMepPointKind,
  {
    label: string;
    shortLabel: string;
    symbol: string;
    colorHex: string;
    defaultHeightCm: number;
  }
> = {
  OUTLET_DOUBLE: {
    label: "Ổ cắm điện đôi 220V",
    shortLabel: "Ổ cắm đôi",
    symbol: "⚡",
    colorHex: "#EA580C",
    defaultHeightCm: 40,
  },
  NETWORK_LAN: {
    label: "Hạt mạng LAN / Cáp quang",
    shortLabel: "Mạng LAN",
    symbol: "LAN",
    colorHex: "#2563EB",
    defaultHeightCm: 45,
  },
  AC_DRAIN: {
    label: "Ống đồng & Nguồn máy lạnh",
    shortLabel: "Chờ Máy lạnh",
    symbol: "AC",
    colorHex: "#0891B2",
    defaultHeightCm: 225,
  },
  WATER_DRAIN: {
    label: "Cấp / Thoát nước máy giặt - RO",
    shortLabel: "Cấp thoát nước",
    symbol: "H2O",
    colorHex: "#0284C7",
    defaultHeightCm: 65,
  },
  LIGHT_SWITCH: {
    label: "Công tắc đèn / Chuông cửa",
    shortLabel: "Công tắc",
    symbol: "SW",
    colorHex: "#CA8A04",
    defaultHeightCm: 120,
  },
};

export function createDefaultSkyOneA2MepPoints(): InteriorMepPoint[] {
  return [
    // Phòng 05 (Dual Growth Studio) — 2 ổ cắm PC đôi + 2 hạt LAN tốc độ cao + ống đồng máy lạnh + công tắc
    {
      id: "mep_r05_pc_left",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm đôi PC Anh Chuột",
      roomId: "room_05",
      x: -2.45,
      z: 3.46,
      heightCm: 40,
      note: "Chạy riêng dây 2.5mm cho dàn PC + màn hình rời",
    },
    {
      id: "mep_r05_pc_right",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm đôi PC Bé Mèo",
      roomId: "room_05",
      x: -1.35,
      z: 3.46,
      heightCm: 40,
      note: "Gần vị trí khay đi dây dưới mặt bàn đôi",
    },
    {
      id: "mep_r05_lan",
      kind: "NETWORK_LAN",
      label: "Cổng LAN Cat6 Dual Studio",
      roomId: "room_05",
      x: -1.9,
      z: 3.46,
      heightCm: 45,
      note: "Kéo từ tủ mạng sảnh vào chia 2 cổng LAN cho 2 máy",
    },
    {
      id: "mep_r05_ac",
      kind: "AC_DRAIN",
      label: "Chờ ống đồng máy lạnh P05",
      roomId: "room_05",
      x: -1.25,
      z: 1.52,
      heightCm: 228,
      note: "Đấu nối ra cục nóng đặt tại Lô gia 08",
    },
    {
      id: "mep_r05_switch",
      kind: "LIGHT_SWITCH",
      label: "Công tắc đèn Phòng 05",
      roomId: "room_05",
      x: -0.26,
      z: 2.38,
      heightCm: 120,
      note: "Không đặt kệ sách che khuất công tắc cửa vào",
    },
    // Phòng khách & Sảnh vào
    {
      id: "mep_liv_tv_power",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm TV & Modem Wifi",
      roomId: "room_living_dining",
      x: 0.72,
      z: -1.35,
      heightCm: 50,
      note: "Âm sau kệ TV treo + vách lam sóng",
    },
    {
      id: "mep_liv_lan",
      kind: "NETWORK_LAN",
      label: "Cáp quang & LAN Phòng khách",
      roomId: "room_living_dining",
      x: 0.72,
      z: -1.05,
      heightCm: 50,
      note: "Đặt Router Wifi 6 trung tâm phủ cả Master & Phòng 05",
    },
    {
      id: "mep_liv_ac",
      kind: "AC_DRAIN",
      label: "Chờ máy lạnh Phòng khách 1.5HP",
      roomId: "room_living_dining",
      x: 3.52,
      z: -1.25,
      heightCm: 230,
      note: "Phía trên Sofa, tránh thổi thẳng vào bàn ăn",
    },
    {
      id: "mep_ent_switch",
      kind: "LIGHT_SWITCH",
      label: "Công tắc tổng Sảnh vào",
      roomId: "room_corridor",
      x: 1.16,
      z: 2.68,
      heightCm: 120,
      note: "Bật tắt nhanh đèn sảnh, phòng khách & bếp",
    },
    // Phòng ngủ Master
    {
      id: "mep_mas_bedside",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm đầu giường Master",
      roomId: "room_master",
      x: -2.4,
      z: -1.55,
      heightCm: 55,
      note: "Sạc điện thoại & đèn ngủ tab đầu giường",
    },
    {
      id: "mep_mas_ac",
      kind: "AC_DRAIN",
      label: "Chờ máy lạnh PN Master 1.0HP",
      roomId: "room_master",
      x: 0.48,
      z: -2.2,
      heightCm: 228,
      note: "Thổi ngang chân giường, tránh phả trực tiếp vào đầu",
    },
    // Bếp & Lô gia giặt phơi
    {
      id: "mep_kit_fridge",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm riêng Tủ lạnh & Lọc RO",
      roomId: "room_kitchen",
      x: 1.58,
      z: 3.46,
      heightCm: 65,
      note: "Ổ điện riêng CB chống giật cho tủ lạnh Inverter",
    },
    {
      id: "mep_log_washer_water",
      kind: "WATER_DRAIN",
      label: "Cấp / Thoát nước Máy giặt",
      roomId: "room_loggia",
      x: -3.55,
      z: -2.38,
      heightCm: 75,
      note: "Vị trí van cấp nước lạnh & phễu thoát sàn Lô gia 08",
    },
    {
      id: "mep_log_washer_power",
      kind: "OUTLET_DOUBLE",
      label: "Ổ cắm chống nước Máy giặt sấy",
      roomId: "room_loggia",
      x: -3.55,
      z: -2.05,
      heightCm: 115,
      note: "Có nắp che chống mưa tạt chuẩn IP55",
    },
  ];
}

/**
 * Mặt bằng chuẩn CAD Loại A2 — 2 Phòng ngủ, 1 WC (DT sử dụng 51.0 m², xây dựng 55.3 m²)
 * Hệ tọa độ: 1 unit = 1 mét. X: -3.80 (trái/Lô gia) -> +3.80 (phải/Sofa+Bếp).
 * Z: -3.70 (trên/Ban công hướng Đông-Đông Nam) -> +3.70 (dưới/Cửa chính Lecmax).
 */
export const SKYONE_A2_BOUNDS = {
  minX: -3.8,
  maxX: 3.8,
  minZ: -3.7,
  maxZ: 3.7,
  totalWidth: 7.6,
  totalDepth: 7.4,
};

export const SKYONE_A2_ROOMS: readonly RoomZoneSpec[] = [
  {
    id: "room_living_dining",
    code: "02",
    name: "Phòng khách & Bàn ăn",
    shortName: "Phòng khách",
    x: 2.0,
    z: -0.25,
    width: 3.3,
    depth: 5.0,
    ceilingHeight: 2.85,
    floorMaterial: "CHANGYIH_TILE",
    developerNote: "Gạch Changyih khổ lớn, trần giật cấp 2.85m, sẵn dây chờ line đèn",
  },
  {
    id: "room_corridor",
    code: "01",
    name: "Sảnh cửa chính & Hành lang",
    shortName: "Sảnh vào",
    x: 0.55,
    z: 1.95,
    width: 1.5,
    depth: 3.3,
    ceilingHeight: 2.85,
    floorMaterial: "CHANGYIH_TILE",
    developerNote: "Cửa chống cháy Lecmax 2 cánh 1.2m, khóa thông minh Hafele 4 chức năng",
  },
  {
    id: "room_balcony",
    code: "03",
    name: "Ban công Đông Nam (2.4m²)",
    shortName: "Ban công",
    x: 2.25,
    z: -3.15,
    width: 2.8,
    depth: 0.95,
    ceilingHeight: 2.85,
    floorMaterial: "LOGGIA_GREY",
    developerNote: "Cửa lùa 3 cánh 2.4m, lan can sắt 1.4m, hộp kỹ thuật góc trái",
  },
  {
    id: "room_kitchen",
    code: "07",
    name: "Bếp chữ L Hafele",
    shortName: "Bếp chữ L",
    x: 2.45,
    z: 2.75,
    width: 2.4,
    depth: 1.7,
    ceilingHeight: 2.85,
    floorMaterial: "CHANGYIH_TILE",
    developerNote: "CĐT bàn giao sẵn: Tủ trên Acrylic, tủ dưới HDF, bếp từ 3 vùng + hút mùi + chậu vòi Hafele",
  },
  {
    id: "room_master",
    code: "04",
    name: "Phòng ngủ Master",
    shortName: "PN Master",
    x: -0.95,
    z: -2.1,
    width: 3.1,
    depth: 3.0,
    ceilingHeight: 2.7,
    floorMaterial: "WOOD_TILE",
    developerNote: "Sàn gạch giả gỗ, trần 2.7m, tường cách âm 20cm, cửa sổ kính lớn",
  },
  {
    id: "room_wc",
    code: "06",
    name: "WC 3 phân khu Hafele",
    shortName: "WC Hafele",
    x: -1.35,
    z: 0.4,
    width: 2.3,
    depth: 2.0,
    ceilingHeight: 2.55,
    floorMaterial: "BATH_MARBLE",
    developerNote: "CĐT bàn giao trọn bộ Hafele: WC riêng, phòng tắm kính đứng có cửa sổ, Lavabo tách rời",
  },
  {
    id: "room_05",
    code: "05",
    name: "Phòng Đa năng (PN2 / Dual Studio)",
    shortName: "Phòng 05",
    x: -1.8,
    z: 2.5,
    width: 3.6,
    depth: 2.2,
    ceilingHeight: 2.7,
    floorMaterial: "WOOD_TILE",
    developerNote: "Sàn gạch giả gỗ, tường bo góc an toàn tiếp giáp WC, cửa thông lô gia lấy sáng tự nhiên",
  },
  {
    id: "room_loggia",
    code: "08",
    name: "Lô gia giặt phơi độc lập",
    shortName: "Lô gia",
    x: -3.15,
    z: -0.7,
    width: 1.15,
    depth: 4.3,
    ceilingHeight: 2.7,
    floorMaterial: "LOGGIA_GREY",
    developerNote: "Sân phơi độc lập, sẵn ổ cắm điện, cấp/thoát nước riêng cho máy giặt",
  },
];

export const SKYONE_A2_WALLS: readonly WallSegmentSpec[] = [
  // Bao ngoài phía Bắc (Ban công + Master + Lô gia)
  { id: "w_north_master", x1: -2.55, z1: -3.6, x2: 0.65, z2: -3.6, thickness: 0.2, height: 2.7, cutawaySide: "NORTH" },
  { id: "w_north_balcony_rail", x1: 0.85, z1: -3.62, x2: 3.65, z2: -3.62, thickness: 0.08, height: 1.4, cutawaySide: "NORTH" },
  { id: "w_north_loggia", x1: -3.72, z1: -2.85, x2: -2.55, z2: -2.85, thickness: 0.12, height: 2.7, cutawaySide: "NORTH" },

  // Bao ngoài phía Đông (Tường phải dài từ Ban công -> Phòng khách -> Bếp)
  { id: "w_east_main", x1: 3.65, z1: -3.62, x2: 3.65, z2: 3.6, thickness: 0.2, height: 2.85, cutawaySide: "EAST" },

  // Bao ngoài phía Nam (Bếp + Cửa chính + Phòng 05)
  { id: "w_south_kitchen", x1: 1.15, z1: 3.6, x2: 3.65, z2: 3.6, thickness: 0.2, height: 2.85, cutawaySide: "SOUTH" },
  { id: "w_south_room05", x1: -3.72, z1: 3.6, x2: -0.05, z2: 3.6, thickness: 0.2, height: 2.7, cutawaySide: "SOUTH" },

  // Bao ngoài phía Tây (Lô gia + Phòng 05)
  { id: "w_west_loggia", x1: -3.72, z1: -2.85, x2: -3.72, z2: 3.6, thickness: 0.2, height: 2.7, cutawaySide: "WEST" },

  // Vách ngăn trong căn hộ
  // Giữa Master & Phòng khách (tường đặt Kệ TV)
  { id: "w_master_living", x1: 0.6, z1: -3.6, x2: 0.6, z2: -0.6, thickness: 0.16, height: 2.75, cutawaySide: "INTERIOR" },
  // Giữa Master & Lô gia
  { id: "w_master_loggia", x1: -2.55, z1: -3.6, x2: -2.55, z2: -0.6, thickness: 0.14, height: 2.7, cutawaySide: "INTERIOR" },
  // Giữa Master & WC (áp tủ quần áo Master)
  { id: "w_master_wc", x1: -2.55, z1: -0.6, x2: -0.2, z2: -0.6, thickness: 0.12, height: 2.7, cutawaySide: "INTERIOR" },

  // Bao khu WC 3 phân khu (bên trái giáp Lô gia, bên phải giáp hành lang, dưới bo cong giáp Phòng 05)
  { id: "w_wc_loggia", x1: -2.55, z1: -0.6, x2: -2.55, z2: 1.1, thickness: 0.12, height: 2.55, cutawaySide: "INTERIOR" },
  { id: "w_wc_corridor_top", x1: -0.2, z1: -0.6, x2: -0.2, z2: 0.15, thickness: 0.1, height: 2.55, cutawaySide: "INTERIOR" },
  { id: "w_wc_corridor_bot", x1: -0.2, z1: 0.95, x2: -0.2, z2: 1.4, thickness: 0.1, height: 2.55, cutawaySide: "INTERIOR" },
  { id: "w_wc_south", x1: -2.2, z1: 1.4, x2: -0.2, z2: 1.4, thickness: 0.12, height: 2.55, cutawaySide: "INTERIOR", isCurvedCorner: true },
  // Vách chia nội bộ WC 3 phân khu (ngăn buồng WC trên và phòng tắm đứng dưới)
  { id: "w_wc_inner_mid", x1: -2.55, z1: 0.25, x2: -1.35, z2: 0.25, thickness: 0.08, height: 2.4, cutawaySide: "INTERIOR" },
  { id: "w_wc_inner_lavabo", x1: -1.3, z1: 0.75, x2: -1.3, z2: 1.4, thickness: 0.08, height: 2.4, cutawaySide: "INTERIOR" },

  // Vách ngăn Phòng 05 & Hành lang cửa chính (có cửa vào phòng 05 ở trên)
  { id: "w_room05_corridor", x1: -0.15, z1: 2.35, x2: -0.15, z2: 3.6, thickness: 0.12, height: 2.7, cutawaySide: "INTERIOR" },

  // Vách ngăn kín đáo giữa Cửa chính & Tủ lạnh / Bếp chữ L
  { id: "w_kitchen_shield", x1: 1.25, z1: 2.55, x2: 1.25, z2: 3.6, thickness: 0.12, height: 2.4, cutawaySide: "INTERIOR" },

  // Vách cửa lùa Ban công (hai trụ biên trái & phải)
  { id: "w_balcony_left_pillar", x1: 0.6, z1: -2.65, x2: 1.05, z2: -2.65, thickness: 0.18, height: 2.85, cutawaySide: "NORTH" },
  { id: "w_balcony_right_pillar", x1: 3.35, z1: -2.65, x2: 3.65, z2: -2.65, thickness: 0.18, height: 2.85, cutawaySide: "NORTH" },
];

export const SKYONE_A2_OPENINGS: readonly OpeningSpec[] = [
  {
    id: "op_main_door",
    kind: "MAIN_DOOR",
    label: "Cửa chính Lecmax 1.2m",
    x: 0.55,
    z: 3.6,
    width: 1.2,
    height: 2.25,
    sillHeight: 0,
    rotationY: 0,
    swingArc: {
      hingeX: 1.05,
      hingeZ: 3.52,
      radius: 0.82,
      startAngleDeg: 180,
      endAngleDeg: 270,
    },
  },
  {
    id: "op_balcony_sliding",
    kind: "SLIDING_BALCONY",
    label: "Cửa lùa 3 cánh 2.4m",
    x: 2.2,
    z: -2.65,
    width: 2.3,
    height: 2.45,
    sillHeight: 0,
    rotationY: 0,
  },
  {
    id: "op_master_window",
    kind: "WINDOW",
    label: "Cửa sổ Master 1.85m",
    wallId: "w_north_master",
    x: -0.95,
    z: -3.6,
    width: 1.85,
    height: 1.5,
    sillHeight: 0.85,
    rotationY: 0,
  },
  {
    id: "op_master_door",
    kind: "INTERIOR_DOOR",
    label: "Cửa phòng ngủ Master",
    x: 0.2,
    z: -0.6,
    width: 0.78,
    height: 2.15,
    sillHeight: 0,
    rotationY: 0,
    swingArc: {
      hingeX: 0.54,
      hingeZ: -0.66,
      radius: 0.72,
      startAngleDeg: 180,
      endAngleDeg: 270,
    },
  },
  {
    id: "op_wc_door",
    kind: "INTERIOR_DOOR",
    label: "Cửa phòng WC 3 phân khu",
    x: -0.2,
    z: 0.55,
    width: 0.76,
    height: 2.1,
    sillHeight: 0,
    rotationY: Math.PI / 2,
    swingArc: {
      hingeX: -0.25,
      hingeZ: 0.18,
      radius: 0.7,
      startAngleDeg: 90,
      endAngleDeg: 180,
    },
  },
  {
    id: "op_room05_door",
    kind: "INTERIOR_DOOR",
    label: "Cửa vào Phòng 05",
    x: -0.15,
    z: 1.88,
    width: 0.84,
    height: 2.15,
    sillHeight: 0,
    rotationY: Math.PI / 2,
    swingArc: {
      hingeX: -0.2,
      hingeZ: 1.46,
      radius: 0.76,
      startAngleDeg: 90,
      endAngleDeg: 180,
    },
  },
  {
    id: "op_room05_loggia",
    kind: "LOGGIA_DOOR",
    label: "Cửa ra Lô gia",
    x: -2.65,
    z: 1.4,
    width: 0.85,
    height: 2.2,
    sillHeight: 0,
    rotationY: 0,
    swingArc: {
      hingeX: -2.28,
      hingeZ: 1.35,
      radius: 0.74,
      startAngleDeg: 180,
      endAngleDeg: 270,
    },
  },
  {
    id: "op_wc_window",
    kind: "WC_WINDOW",
    label: "Cửa sổ lấy gió WC",
    wallId: "w_wc_loggia",
    x: -2.55,
    z: 0.72,
    width: 0.55,
    height: 0.75,
    sillHeight: 1.45,
    rotationY: Math.PI / 2,
  },
];

export interface CatalogItemTemplate {
  catalogKey: InteriorCatalogKey;
  name: string;
  categoryLabel: string;
  defaultRoomId: string;
  defaultDimensionsCm: { width: number; depth: number; height: number };
  defaultFinish: InteriorMaterialFinish;
  pricingRule: InteriorFurnitureItem["pricingRule"];
  unitPriceVnd: number;
  boqGroup: InteriorFurnitureItem["boqGroup"];
  source: InteriorFurnitureItem["source"];
  note: string;
}

export const INTERIOR_CATALOG: readonly CatalogItemTemplate[] = [
  // Phòng khách & Sảnh
  {
    catalogKey: "sofa_3seat",
    name: "Sofa văng 3 chỗ vải Bouclé",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 215, depth: 85, height: 78 },
    defaultFinish: "CREAM_BOUCLE",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 11_500_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Khung gỗ sồi tự nhiên, đệm mút D40 êm ái",
  },
  {
    catalogKey: "accent_armchair",
    name: "Ghế đơn thư giãn Armchair",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 72, depth: 74, height: 78 },
    defaultFinish: "CREAM_BOUCLE",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 3_800_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Tạo góc tiếp khách & đọc sách ấm cúng",
  },
  {
    catalogKey: "coffee_table",
    name: "Bàn trà mặt đá bo tròn",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 100, depth: 55, height: 40 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 2_900_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "An toàn bo góc, chân gỗ sồi đồng bộ",
  },
  {
    catalogKey: "area_rug",
    name: "Thảm dệt phòng khách",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 220, depth: 160, height: 2 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 1_900_000,
    boqGroup: "FINISHING_DECOR",
    source: "NEW_PURCHASE",
    note: "Thảm lông ngắn dễ hút bụi robot",
  },
  {
    catalogKey: "tv_console_slat",
    name: "Kệ TV treo + Vách lam sóng",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 200, depth: 36, height: 220 },
    defaultFinish: "WARM_OAK",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 4_200_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "MDF chống ẩm An Cường + đèn LED hắt vách",
  },
  {
    catalogKey: "shoe_cabinet_tall",
    name: "Tủ giày kịch trần sảnh vào",
    categoryLabel: "Phòng khách",
    defaultRoomId: "room_corridor",
    defaultDimensionsCm: { width: 110, depth: 35, height: 260 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 5_200_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Có hộc để chìa khóa & ghế ngồi mang giày",
  },
  // Bếp & Ăn
  {
    catalogKey: "dining_set_4",
    name: "Bộ bàn ăn 4 ghế gỗ sồi",
    categoryLabel: "Bếp & Ăn",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 125, depth: 75, height: 75 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 7_500_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Bàn 1m25 gọn chuẩn lối đi >= 90cm",
  },
  {
    catalogKey: "kitchen_l_hafele",
    name: "Hệ tủ bếp chữ L + Hafele (CĐT)",
    categoryLabel: "Bếp & Ăn",
    defaultRoomId: "room_kitchen",
    defaultDimensionsCm: { width: 220, depth: 165, height: 240 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 0,
    boqGroup: "DEVELOPER_INCLUDED",
    source: "DEVELOPER_INCLUDED",
    note: "CĐT bàn giao sẵn: Acrylic trên, HDF dưới, bếp từ 3 vùng + hút mùi + chậu vòi Hafele",
  },
  // Phòng ngủ Master
  {
    catalogKey: "bed_master_160",
    name: "Giường Master 1m6 + Nệm cao su",
    categoryLabel: "Phòng ngủ Master",
    defaultRoomId: "room_master",
    defaultDimensionsCm: { width: 170, depth: 205, height: 105 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 12_500_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Giường hộc kéo MDF chống ẩm + nệm 1m6×2m",
  },
  {
    catalogKey: "nightstand",
    name: "Tab đầu giường + Đèn ngủ",
    categoryLabel: "Phòng ngủ Master",
    defaultRoomId: "room_master",
    defaultDimensionsCm: { width: 45, depth: 40, height: 48 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 1_200_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Có ngăn kéo gọn gàng",
  },
  {
    catalogKey: "wardrobe_tall",
    name: "Tủ quần áo kịch trần Master",
    categoryLabel: "Phòng ngủ Master",
    defaultRoomId: "room_master",
    defaultDimensionsCm: { width: 210, depth: 58, height: 265 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 5_800_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Cánh mở bản lề giảm chấn, khoang treo & ngăn gấp",
  },
  // Phòng 05: Phương án A (PN2) & Phương án B (Dual Growth Studio)
  {
    catalogKey: "bed_compact_140",
    name: "Giường 1m4 đa năng / Sofa-bed",
    categoryLabel: "Phòng 05",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 145, depth: 195, height: 92 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 8_200_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Tối ưu cho phòng ngủ 2 đón người thân",
  },
  {
    catalogKey: "wardrobe_compact",
    name: "Tủ quần áo phòng 05",
    categoryLabel: "Phòng 05",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 130, depth: 55, height: 245 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 5_200_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "MDF chống ẩm, cánh phẳng tối giản",
  },
  {
    catalogKey: "dual_workstation_desk",
    name: "Hệ bàn làm việc đôi 2 PC / Laptop",
    categoryLabel: "Dual Studio (PA-B)",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 235, depth: 68, height: 75 },
    defaultFinish: "WARM_OAK",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 3_600_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Đặt trọn 2 dàn PC màn hình rời / 2 Laptop + khay đi dây ẩn + đèn màn hình ấm",
  },
  {
    catalogKey: "single_desk",
    name: "Bàn làm việc đơn 1m2",
    categoryLabel: "Phòng 05",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 120, depth: 60, height: 75 },
    defaultFinish: "WARM_OAK",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 2_800_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Gọn nhẹ sát cửa lô gia lấy ánh sáng tự nhiên",
  },
  {
    catalogKey: "ergonomic_chair",
    name: "Ghế công thái học Ergonomic",
    categoryLabel: "Dual Studio (PA-B)",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 64, depth: 62, height: 116 },
    defaultFinish: "CHARCOAL_SLATE",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 3_400_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Tựa lưng lưới thoáng khí, tựa đầu & kê tay 3D",
  },
  {
    catalogKey: "tall_bookshelf_led",
    name: "Hệ kệ sách kịch trần + LED 3000K",
    categoryLabel: "Dual Studio (PA-B)",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 155, depth: 36, height: 260 },
    defaultFinish: "WARM_OAK",
    pricingRule: "PER_LINEAR_METER",
    unitPriceVnd: 5_400_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Lưu trữ sách chuyên ngành, tài liệu & tủ đồ kín bên dưới",
  },
  {
    catalogKey: "pegboard_goal_wall",
    name: "Bảng Pegboard & Bảng mục tiêu đôi",
    categoryLabel: "Dual Studio (PA-B)",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 180, depth: 8, height: 85 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 2_100_000,
    boqGroup: "FINISHING_DECOR",
    source: "NEW_PURCHASE",
    note: "Treo phụ kiện công nghệ, ghi chú học tập & mục tiêu tài chính gia đình",
  },
  {
    catalogKey: "reading_lounge_chair",
    name: "Ghế đọc sách & Đôn thư giãn",
    categoryLabel: "Dual Studio (PA-B)",
    defaultRoomId: "room_05",
    defaultDimensionsCm: { width: 70, depth: 75, height: 82 },
    defaultFinish: "SAGE_LINEN",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 3_600_000,
    boqGroup: "WOOD_FURNITURE",
    source: "NEW_PURCHASE",
    note: "Góc nạp năng lượng bên ánh sáng tự nhiên cửa lô gia",
  },
  // Điện máy & Thiết bị
  {
    catalogKey: "fridge_inverter",
    name: "Tủ lạnh Inverter 350L–400L",
    categoryLabel: "Điện máy",
    defaultRoomId: "room_kitchen",
    defaultDimensionsCm: { width: 65, depth: 66, height: 175 },
    defaultFinish: "BRUSHED_TITANIUM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 11_500_000,
    boqGroup: "APPLIANCES",
    source: "NEW_PURCHASE",
    note: "Vừa khít ô tủ lạnh cạnh vách ngăn cửa chính",
  },
  {
    catalogKey: "washer_dryer",
    name: "Máy giặt sấy cửa trước 10kg",
    categoryLabel: "Điện máy",
    defaultRoomId: "room_loggia",
    defaultDimensionsCm: { width: 60, depth: 60, height: 85 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 11_200_000,
    boqGroup: "APPLIANCES",
    source: "NEW_PURCHASE",
    note: "Đặt đúng vị trí cấp thoát nước tại Lô gia 08",
  },
  {
    catalogKey: "smart_tv",
    name: "Smart TV 4K 55 inch",
    categoryLabel: "Điện máy",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 123, depth: 8, height: 72 },
    defaultFinish: "CHARCOAL_SLATE",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 9_800_000,
    boqGroup: "APPLIANCES",
    source: "NEW_PURCHASE",
    note: "Gắn tường phẳng trên hệ vách lam sóng phòng khách",
  },
  {
    catalogKey: "ac_inverter",
    name: "Máy lạnh Inverter 1.0–1.5 HP",
    categoryLabel: "Điện máy",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 85, depth: 22, height: 29 },
    defaultFinish: "MATTE_CREAM",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 9_200_000,
    boqGroup: "APPLIANCES",
    source: "NEW_PURCHASE",
    note: "Đã bao gồm ống đồng & công lắp đặt cơ bản",
  },
  // Cây xanh & WC CĐT
  {
    catalogKey: "floor_plant",
    name: "Cây xanh nội thất (Bàng Singapore / Trầu bà)",
    categoryLabel: "Trang trí",
    defaultRoomId: "room_living_dining",
    defaultDimensionsCm: { width: 42, depth: 42, height: 135 },
    defaultFinish: "SAGE_LINEN",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 650_000,
    boqGroup: "FINISHING_DECOR",
    source: "NEW_PURCHASE",
    note: "Tạo sinh khí xanh tự nhiên cho góc sofa / phòng làm việc",
  },
  {
    catalogKey: "balcony_planter",
    name: "Chậu cây ban công + Tiểu cảnh",
    categoryLabel: "Trang trí",
    defaultRoomId: "room_balcony",
    defaultDimensionsCm: { width: 85, depth: 34, height: 65 },
    defaultFinish: "SAGE_LINEN",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 1_100_000,
    boqGroup: "FINISHING_DECOR",
    source: "NEW_PURCHASE",
    note: "Đón nắng Đông Nam buổi sáng, lọc bụi mịn",
  },
  {
    catalogKey: "wc_hafele_set",
    name: "Thiết bị WC 3 phân khu Hafele (CĐT)",
    categoryLabel: "CĐT bàn giao",
    defaultRoomId: "room_wc",
    defaultDimensionsCm: { width: 215, depth: 185, height: 220 },
    defaultFinish: "WHITE_MARBLE",
    pricingRule: "FIXED_UNIT",
    unitPriceVnd: 0,
    boqGroup: "DEVELOPER_INCLUDED",
    source: "DEVELOPER_INCLUDED",
    note: "Bàn giao sẵn bồn cầu, vách tắm kính vòi sen đứng, lavabo sứ Hafele",
  },
];

function createCommonBaseItems(): InteriorFurnitureItem[] {
  return [
    // CĐT bàn giao sẵn (0 đ)
    {
      id: "it_kitchen_hafele",
      catalogKey: "kitchen_l_hafele",
      name: "Hệ tủ bếp chữ L + Thiết bị Hafele (CĐT)",
      roomId: "room_kitchen",
      source: "DEVELOPER_INCLUDED",
      position: { x: 2.75, z: 2.75 },
      rotationDeg: 0,
      dimensionsCm: { width: 155, depth: 155, height: 240 },
      materialFinish: "MATTE_CREAM",
      isLocked: true,
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 0,
      boqGroup: "DEVELOPER_INCLUDED",
      procurementStatus: "INSTALLED",
      note: "CĐT bàn giao sẵn: Acrylic trên, HDF dưới, bếp từ 3 vùng, hút mùi, chậu vòi Hafele",
    },
    {
      id: "it_wc_hafele",
      catalogKey: "wc_hafele_set",
      name: "Trọn bộ WC 3 phân khu Hafele (CĐT)",
      roomId: "room_wc",
      source: "DEVELOPER_INCLUDED",
      position: { x: -1.35, z: 0.4 },
      rotationDeg: 0,
      dimensionsCm: { width: 215, depth: 185, height: 220 },
      materialFinish: "WHITE_MARBLE",
      isLocked: true,
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 0,
      boqGroup: "DEVELOPER_INCLUDED",
      procurementStatus: "INSTALLED",
      note: "CĐT bàn giao sẵn: Buồng WC, phòng tắm kính đứng, Lavabo tách rời Hafele",
    },
    // Phòng khách & Sảnh (Modern Warm)
    {
      id: "it_sofa_main",
      catalogKey: "sofa_3seat",
      name: "Sofa văng 3 chỗ vải Bouclé kem",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 3.12, z: -1.25 },
      rotationDeg: -90,
      dimensionsCm: { width: 200, depth: 82, height: 78 },
      materialFinish: "CREAM_BOUCLE",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 9_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_coffee_table",
      catalogKey: "coffee_table",
      name: "Bàn trà gỗ sồi bo tròn",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 1.98, z: -1.25 },
      rotationDeg: 90,
      dimensionsCm: { width: 92, depth: 50, height: 40 },
      materialFinish: "WARM_OAK",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 2_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_living_rug",
      catalogKey: "area_rug",
      name: "Thảm dệt phòng khách Modern Warm",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 2.35, z: -1.25 },
      rotationDeg: 90,
      dimensionsCm: { width: 210, depth: 155, height: 2 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 1_500_000,
      boqGroup: "FINISHING_DECOR",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_tv_console",
      catalogKey: "tv_console_slat",
      name: "Kệ TV treo + Vách lam sóng gỗ sồi",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 0.92, z: -1.35 },
      rotationDeg: 90,
      dimensionsCm: { width: 185, depth: 36, height: 225 },
      materialFinish: "WARM_OAK",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 3_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_smart_tv",
      catalogKey: "smart_tv",
      name: "Smart TV 4K 55 inch",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 0.85, z: -1.35 },
      rotationDeg: 90,
      dimensionsCm: { width: 123, depth: 8, height: 72 },
      materialFinish: "CHARCOAL_SLATE",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 8_500_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_dining_set",
      catalogKey: "dining_set_4",
      name: "Bộ bàn ăn 4 ghế gỗ sồi ấm",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 2.8, z: 0.65 },
      rotationDeg: 0,
      dimensionsCm: { width: 125, depth: 75, height: 75 },
      materialFinish: "WARM_OAK",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 6_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_shoe_cabinet",
      catalogKey: "shoe_cabinet_tall",
      name: "Tủ giày kịch trần + Hộc chìa khóa",
      roomId: "room_corridor",
      source: "NEW_PURCHASE",
      position: { x: 0.08, z: 2.86 },
      rotationDeg: 90,
      dimensionsCm: { width: 92, depth: 30, height: 260 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 4_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    // Phòng ngủ Master (04)
    {
      id: "it_master_bed",
      catalogKey: "bed_master_160",
      name: "Giường Master 1m6 hộc kéo + Nệm",
      roomId: "room_master",
      source: "NEW_PURCHASE",
      position: { x: -1.35, z: -2.55 },
      rotationDeg: 90,
      dimensionsCm: { width: 164, depth: 202, height: 105 },
      materialFinish: "WARM_OAK",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 10_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_master_nightstand",
      catalogKey: "nightstand",
      name: "Tab đầu giường + Đèn ngủ ấm",
      roomId: "room_master",
      source: "NEW_PURCHASE",
      position: { x: -2.18, z: -1.52 },
      rotationDeg: 90,
      dimensionsCm: { width: 38, depth: 36, height: 48 },
      materialFinish: "WARM_OAK",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 950_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_master_wardrobe",
      catalogKey: "wardrobe_tall",
      name: "Tủ quần áo kịch trần Master",
      roomId: "room_master",
      source: "NEW_PURCHASE",
      position: { x: -1.35, z: -0.94 },
      rotationDeg: 0,
      dimensionsCm: { width: 200, depth: 54, height: 260 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 4_600_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    // Điện máy thiết yếu chung
    {
      id: "it_fridge",
      catalogKey: "fridge_inverter",
      name: "Tủ lạnh Inverter 360L",
      roomId: "room_kitchen",
      source: "NEW_PURCHASE",
      position: { x: 1.65, z: 3.1 },
      rotationDeg: 180,
      dimensionsCm: { width: 62, depth: 64, height: 175 },
      materialFinish: "BRUSHED_TITANIUM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 9_800_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_washer",
      catalogKey: "washer_dryer",
      name: "Máy giặt sấy cửa trước Inverter",
      roomId: "room_loggia",
      source: "NEW_PURCHASE",
      position: { x: -3.15, z: -2.38 },
      rotationDeg: 0,
      dimensionsCm: { width: 60, depth: 60, height: 85 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 9_500_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_ac_living",
      catalogKey: "ac_inverter",
      name: "Máy lạnh Inverter 1.5HP (Phòng khách)",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 3.42, z: -1.25 },
      rotationDeg: -90,
      dimensionsCm: { width: 86, depth: 22, height: 29 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 8_800_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_ac_master",
      catalogKey: "ac_inverter",
      name: "Máy lạnh Inverter 1.0HP (PN Master)",
      roomId: "room_master",
      source: "NEW_PURCHASE",
      position: { x: 0.38, z: -2.2 },
      rotationDeg: -90,
      dimensionsCm: { width: 80, depth: 21, height: 28 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 7_400_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
    // Cây xanh & Ban công
    {
      id: "it_plant_living",
      catalogKey: "floor_plant",
      name: "Cây xanh góc Sofa",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 3.25, z: -0.05 },
      rotationDeg: 0,
      dimensionsCm: { width: 38, depth: 38, height: 135 },
      materialFinish: "SAGE_LINEN",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 550_000,
      boqGroup: "FINISHING_DECOR",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_balcony_planter",
      catalogKey: "balcony_planter",
      name: "Tiểu cảnh chậu cây Ban công 2.4m²",
      roomId: "room_balcony",
      source: "NEW_PURCHASE",
      position: { x: 3.12, z: -3.25 },
      rotationDeg: 0,
      dimensionsCm: { width: 82, depth: 32, height: 65 },
      materialFinish: "SAGE_LINEN",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 950_000,
      boqGroup: "FINISHING_DECOR",
      procurementStatus: "PLANNED",
    },
  ];
}

export function createScenarioAGuestBedroom(): InteriorDesignScenario {
  const base = createCommonBaseItems();
  const room05Items: InteriorFurnitureItem[] = [
    {
      id: "it_pa_bed_140",
      catalogKey: "bed_compact_140",
      name: "Giường 1m4 đa năng / Sofa-bed (Phòng 05)",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -2.42, z: 2.75 },
      rotationDeg: 90,
      dimensionsCm: { width: 140, depth: 195, height: 92 },
      materialFinish: "WARM_OAK",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 8_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_pa_wardrobe_05",
      catalogKey: "wardrobe_compact",
      name: "Tủ quần áo gọn Phòng 05",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -0.58, z: 2.8 },
      rotationDeg: -90,
      dimensionsCm: { width: 125, depth: 52, height: 245 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 5_000_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
  ];

  return {
    id: "scenario_a_pn2_flexible",
    code: "A",
    name: "Phương án A · Phòng Ngủ 2 Linh Hoạt",
    shortLabel: "PA-A · PN2 (~118tr)",
    description:
      "Tối ưu dòng tiền Q3/2027 trong khung ~118 triệu trọn gói gỗ + điện máy. Khu 05 bố trí giường phụ 1m4 + tủ áo gọn đón người thân, giữ biên an toàn ~32 triệu cho Quỹ Đệm 08/2028.",
    stylePreset: "MODERN_WARM",
    targetBudgetMinVnd: 100_000_000,
    targetBudgetMaxVnd: 150_000_000,
    contingencyPercent: 5,
    items: [...base, ...room05Items],
    extraBoqItems: [
      {
        id: "ex_curtains_a",
        name: "Rèm vải 2 lớp chống nắng (Ban công 2.4m + PN Master)",
        roomId: "room_living_dining",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "bộ",
        quantity: 2,
        unitPriceVnd: 2_600_000,
        procurementStatus: "PLANNED",
      },
      {
        id: "ex_lighting_a",
        name: "Line đèn LED khe trần giật cấp 2.85m + Đèn thả bàn ăn",
        roomId: "room_living_dining",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "gói",
        quantity: 1,
        unitPriceVnd: 3_200_000,
        procurementStatus: "PLANNED",
      },
      {
        id: "ex_drying_rack_a",
        name: "Giàn phơi thông minh gắn trần Lô gia 08 + Lưới an toàn",
        roomId: "room_loggia",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "gói",
        quantity: 1,
        unitPriceVnd: 2_400_000,
        procurementStatus: "PLANNED",
      },
    ],
    mepPoints: createDefaultSkyOneA2MepPoints(),
    updatedAt: "2026-11-20T08:00:00.000Z",
  };
}

export function createScenarioBDualGrowthStudio(): InteriorDesignScenario {
  const base = createCommonBaseItems();
  const extraLivingItems: InteriorFurnitureItem[] = [
    {
      id: "it_pb_armchair",
      catalogKey: "accent_armchair",
      name: "Ghế đơn Armchair thư giãn Phòng khách",
      roomId: "room_living_dining",
      source: "NEW_PURCHASE",
      position: { x: 1.62, z: -0.15 },
      rotationDeg: 35,
      dimensionsCm: { width: 68, depth: 70, height: 78 },
      materialFinish: "CREAM_BOUCLE",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 3_600_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
  ];

  // Khu 05: Phòng Làm Việc & Học Tập Chung 2 Vợ Chồng — Dual Growth Studio
  const dualStudioItems: InteriorFurnitureItem[] = [
    {
      id: "it_pb_dual_desk",
      catalogKey: "dual_workstation_desk",
      name: "Hệ bàn làm việc đôi 2m15 (2 dàn PC / Laptop)",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -1.9, z: 3.12 },
      rotationDeg: 180,
      dimensionsCm: { width: 215, depth: 66, height: 75 },
      materialFinish: "WARM_OAK",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 2_900_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
      note: "2 góc làm việc độc lập cho Anh Chuột & Bé Mèo, đủ đặt 2 màn hình rời + PC/Laptop, khay đi dây ẩn & đèn ấm",
    },
    {
      id: "it_pb_chair_husband",
      catalogKey: "ergonomic_chair",
      name: "Ghế công thái học Anh Chuột",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -2.35, z: 2.46 },
      rotationDeg: 0,
      dimensionsCm: { width: 62, depth: 60, height: 116 },
      materialFinish: "CHARCOAL_SLATE",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 2_800_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_pb_chair_wife",
      catalogKey: "ergonomic_chair",
      name: "Ghế công thái học Bé Mèo",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -1.35, z: 2.46 },
      rotationDeg: 0,
      dimensionsCm: { width: 62, depth: 60, height: 116 },
      materialFinish: "CREAM_BOUCLE",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 2_800_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_pb_bookshelf_led",
      catalogKey: "tall_bookshelf_led",
      name: "Hệ tủ kệ sách kịch trần + LED hắt 3000K",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -0.45, z: 2.82 },
      rotationDeg: -90,
      dimensionsCm: { width: 135, depth: 36, height: 260 },
      materialFinish: "WARM_OAK",
      pricingRule: "PER_LINEAR_METER",
      unitPriceVnd: 4_200_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
      note: "Kệ trưng bày sách học tập, chứng chỉ, mô hình truyền cảm hứng + tủ lưu trữ kín phía dưới",
    },
    {
      id: "it_pb_pegboard",
      catalogKey: "pegboard_goal_wall",
      name: "Bảng Pegboard & Bảng mục tiêu phát triển",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -1.9, z: 3.44 },
      rotationDeg: 180,
      dimensionsCm: { width: 180, depth: 8, height: 85 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 1_800_000,
      boqGroup: "FINISHING_DECOR",
      procurementStatus: "PLANNED",
      note: "Gắn ngay trên mặt bàn đôi, treo tai nghe, sổ tay & Roadmap tài chính 2027-2028",
    },
    {
      id: "it_pb_reading_chair",
      catalogKey: "reading_lounge_chair",
      name: "Ghế đọc sách thư giãn cạnh cửa Lô gia",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -3.12, z: 1.88 },
      rotationDeg: 35,
      dimensionsCm: { width: 62, depth: 62, height: 82 },
      materialFinish: "SAGE_LINEN",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 2_800_000,
      boqGroup: "WOOD_FURNITURE",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_pb_studio_plant",
      catalogKey: "floor_plant",
      name: "Cây xanh lọc khí Phòng Studio",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -3.35, z: 3.18 },
      rotationDeg: 0,
      dimensionsCm: { width: 38, depth: 38, height: 125 },
      materialFinish: "SAGE_LINEN",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 550_000,
      boqGroup: "FINISHING_DECOR",
      procurementStatus: "PLANNED",
    },
    {
      id: "it_pb_ac_studio",
      catalogKey: "ac_inverter",
      name: "Máy lạnh Inverter 1.0HP (Phòng làm việc)",
      roomId: "room_05",
      source: "NEW_PURCHASE",
      position: { x: -1.25, z: 1.56 },
      rotationDeg: 0,
      dimensionsCm: { width: 80, depth: 21, height: 28 },
      materialFinish: "MATTE_CREAM",
      pricingRule: "FIXED_UNIT",
      unitPriceVnd: 7_400_000,
      boqGroup: "APPLIANCES",
      procurementStatus: "PLANNED",
    },
  ];

  return {
    id: "scenario_b_dual_growth_studio",
    code: "B",
    name: "Phương án B · Dual Growth Studio (2 Vợ Chồng)",
    shortLabel: "PA-B · Studio Đôi (~140tr)",
    description:
      "Biến Khu 05 thành Phòng Làm Việc & Học Tập Chung năng động, có gu thẩm mỹ cho 2 dàn PC/Laptop, 2 ghế công thái học, hệ kệ sách đèn LED 3000K, bảng Pegboard mục tiêu, ghế đọc sách & máy lạnh riêng — gọn trong trần 150 triệu.",
    stylePreset: "MODERN_WARM",
    targetBudgetMinVnd: 100_000_000,
    targetBudgetMaxVnd: 150_000_000,
    contingencyPercent: 5,
    items: [...base, ...extraLivingItems, ...dualStudioItems],
    extraBoqItems: [
      {
        id: "ex_curtains_b",
        name: "Rèm vải 2 lớp chống nắng (Ban công 2.4m + PN Master + Cửa Lô gia)",
        roomId: "room_living_dining",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "bộ",
        quantity: 3,
        unitPriceVnd: 2_300_000,
        procurementStatus: "PLANNED",
      },
      {
        id: "ex_lighting_b",
        name: "Line đèn LED trần giật cấp 2.85m + Đèn thả bàn ăn + Đèn ray Studio",
        roomId: "room_05",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "gói",
        quantity: 1,
        unitPriceVnd: 4_500_000,
        procurementStatus: "PLANNED",
      },
      {
        id: "ex_drying_rack_b",
        name: "Giàn phơi thông minh Lô gia 08 + Lưới an toàn ban công",
        roomId: "room_loggia",
        boqGroup: "FINISHING_DECOR",
        source: "NEW_PURCHASE",
        unit: "gói",
        quantity: 1,
        unitPriceVnd: 2_400_000,
        procurementStatus: "PLANNED",
      },
    ],
    mepPoints: createDefaultSkyOneA2MepPoints(),
    updatedAt: "2026-11-20T08:00:00.000Z",
  };
}

export function createDefaultHandoverChecklist(): HandoverChecklistItem[] {
  return [
    {
      id: "chk_01_door",
      zoneCode: "01",
      zoneName: "Cửa chính",
      title: "Nghiệm thu cửa thép chống cháy Lecmax 2 cánh (1.2m)",
      specDetail: "Kiểm tra bản lề, gioăng chống ồn, độ khít và test 4 tính năng khóa thông minh Hafele.",
      checked: false,
    },
    {
      id: "chk_02_floor",
      zoneCode: "02",
      zoneName: "Phòng khách",
      title: "Gõ kiểm tra bộp gạch Changyih khổ lớn & độ phẳng sàn",
      specDetail: "Kiểm tra ron gạch đều, không sứt mẻ, đo lại kích thước lọt lòng trước khi đóng tủ giày & kệ TV.",
      checked: false,
    },
    {
      id: "chk_02_ceiling",
      zoneCode: "02",
      zoneName: "Phòng khách",
      title: "Test nguồn điện chờ trần giật cấp 2.85m & cảm biến khói/sprinkler",
      specDetail: "Đảm bảo đầu dây chờ line đèn khe trần và vị trí đèn thả bàn ăn hoạt động ổn định.",
      checked: false,
    },
    {
      id: "chk_03_balcony",
      zoneCode: "03",
      zoneName: "Ban công",
      title: "Kiểm tra ray trượt cửa kính lùa 3 cánh (2.4m) & lan can 1.4m",
      specDetail: "Đổ nước test độ dốc thoát sàn ban công 2.4m², kiểm tra chống thấm hộp kỹ thuật góc trái.",
      checked: false,
    },
    {
      id: "chk_04_master",
      zoneCode: "04",
      zoneName: "PN Master",
      title: "Kiểm tra sàn gạch giả gỗ, cửa sổ kính lớn & tường cách âm 20cm",
      specDetail: "Test độ kín khít cửa sổ khi mưa tạt hướng Đông Nam, đo hốc chờ ống đồng máy lạnh.",
      checked: false,
    },
    {
      id: "chk_05_studio",
      zoneCode: "05",
      zoneName: "Phòng 05",
      title: "Kiểm tra tường bo góc an toàn, cửa ra Lô gia & ổ cắm góc làm việc",
      specDetail: "Xác nhận vị trí ổ điện & dây mạng LAN cho bàn đôi 2 PC/Laptop (Phương án B).",
      checked: false,
    },
    {
      id: "chk_06_wc",
      zoneCode: "06",
      zoneName: "WC 3 phân khu",
      title: "Test toàn bộ thiết bị Hafele (WC, phòng tắm đứng, Lavabo tách rời)",
      specDetail: "Xả nước mạnh kiểm tra áp lực vòi sen đứng, độ dốc thoát sàn, vách kính không rò nước & cửa sổ thông gió.",
      checked: false,
    },
    {
      id: "chk_07_kitchen",
      zoneCode: "07",
      zoneName: "Bếp chữ L",
      title: "Test bếp điện từ 3 vùng Hafele, máy hút mùi & chậu vòi inox",
      specDetail: "Kiểm tra bản lề tủ bếp trên Acrylic & tủ dưới HDF chống ẩm, đo chuẩn ô tủ lạnh (66cm) và cấp nước RO.",
      checked: false,
    },
    {
      id: "chk_08_loggia",
      zoneCode: "08",
      zoneName: "Lô gia giặt phơi",
      title: "Kiểm tra ổ cắm chống nước, van cấp & ống thoát máy giặt",
      specDetail: "Test thoát sàn lô gia và kiểm tra khoảng trống trần để lắp giàn phơi thông minh.",
      checked: false,
    },
  ];
}

export function createDefaultInteriorStudio(): InteriorStudioState {
  const scenarioA = createScenarioAGuestBedroom();
  const scenarioB = createScenarioBDualGrowthStudio();
  return {
    apartmentCode: "A.12A.07 · Loại A2 (2PN 1WC)",
    usableAreaSqm: 51.0,
    builtUpAreaSqm: 55.3,
    orientation: "EAST_SOUTHEAST",
    activeScenarioId: scenarioB.id, // Mở sẵn Phương án B (Dual Growth Studio) để vợ chồng trải nghiệm ngay
    scenarios: [scenarioA, scenarioB],
    handoverChecklist: createDefaultHandoverChecklist(),
    updatedAt: "2026-11-20T08:00:00.000Z",
  };
}
