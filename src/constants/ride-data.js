// RIDE DATA - Dữ liệu mẫu cho nhóm xe và chuyến đi
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

export const rideGroups = [
  {
    id: "shared-1",
    route: "Cổng Chính FPT → Ngã tư Thạch Hòa",
    vehicle: "Xe 7 chỗ",
    price: "42.000đ",
    distance: "25 km",
    seats: "2/7 thành viên",
    note: "Xe ghép ra ngã tư đặt xe khách, có điều hòa",
    status: "Chưa tham gia",
    driver: "Nguyễn Thị Hương",
    destination: "Cổng Chính FPT → Ngã tư Thạch Hòa",
    participantCount: 2,
    capacity: 7,
    perPersonPrice: "14.000đ/người",
  },
  {
    id: "shared-2",
    route: "Đại học FPT → Bến xe Mỹ Đình",
    vehicle: "Xe 4 chỗ",
    price: "30.000đ",
    distance: "18 km",
    seats: "1/4 thành viên",
    note: "Xe sạch sẽ, tài xế thân thiện",
    status: "Đã tham gia",
    driver: "Lê Nguyễn Đại Hải",
    destination: "Đại học FPT → Bến xe Mỹ Đình",
    participantCount: 1,
    capacity: 4,
    perPersonPrice: "15.000đ/người",
  },
];

// getRideGroupById: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
export function getRideGroupById(id) {
  return rideGroups.find((ride) => ride.id === id);
}

// recentTrips: Hằng số export để các màn hình/service khác dùng chung
export const recentTrips = [
  {
    route: "Cổng FPT → Bến xe Mỹ Đình",
    meta: "Hôm qua · 45.000đ · Tiền mặt",
    icon: "🛵",
  },
  {
    route: "Ngã tư Thạch Hòa → Cổng FPT",
    meta: "23/06 · 25.000đ · Tiền mặt",
    icon: "🚗",
  },
];

// scheduledTrips: Hằng số export để các màn hình/service khác dùng chung
export const scheduledTrips = [
  {
    id: "schedule-1",
    status: "Chờ tài xế",
    from: "Bến xe Mỹ Đình",
    to: "Đại học FPT",
    vehicle: "Xe 4 chỗ",
    price: "45.000đ",
    time: "Hôm nay 15:30",
  },
  {
    id: "schedule-2",
    status: "Chờ tài xế",
    from: "Ngã tư Thạch Hòa",
    to: "Vị trí hiện tại",
    vehicle: "Xe máy",
    price: "25.000đ",
    time: "28/06 08:00",
  },
];

// tripSections: Hằng số export để các màn hình/service khác dùng chung
export const tripSections = {
  active: [
    {
      id: "active-1",
      icon: "🛵",
      route: "Cổng FPT → Mỹ Đình",
      meta: "Đang đến điểm đón · 45.000đ",
      actionPrimary: "Liên hệ",
      actionSecondary: "Hủy",
      rating: null,
    },
  ],
  scheduled: [
    {
      id: "planned-1",
      icon: "🚗",
      route: "Bến xe Mỹ Đình → Đại học FPT",
      meta: "Hôm nay 15:30 · 45.000đ",
      actionPrimary: "Sửa",
      actionSecondary: "Hủy",
      rating: null,
    },
    {
      id: "planned-2",
      icon: "🛵",
      route: "Ngã tư Thạch Hòa → Vị trí hiện tại",
      meta: "28/06 08:00 · 25.000đ",
      actionPrimary: "Sửa",
      actionSecondary: "Hủy",
      rating: null,
    },
  ],
  history: [
    {
      id: "history-1",
      icon: "🛵",
      route: "Cổng FPT → Mỹ Đình",
      meta: "24/06 · 45.000đ",
      actionPrimary: "Đánh giá",
      actionSecondary: "Báo cáo",
      rating: 5,
    },
    {
      id: "history-2",
      icon: "🚗",
      route: "Ngã tư Thạch Hòa → FPT",
      meta: "23/06 · 25.000đ",
      actionPrimary: "Đánh giá",
      actionSecondary: "Báo cáo",
      rating: 5,
    },
    {
      id: "history-3",
      icon: "🚗",
      route: "FPT → Xuân Mai",
      meta: "22/06 · 35.000đ",
      actionPrimary: "Đánh giá",
      actionSecondary: "Báo cáo",
      rating: 4,
    },
  ],
};
