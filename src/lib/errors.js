// Supabase RPC funksiyalari xatolarni doim o'zbek tilida "raise exception"
// qiladi (ular Postgres ichida yozilgan). Shu ma'lum matnларni i18n
// kalitlariga moslashtirib, UI tilida ko'rsatamiz. Notanish xato bo'lsa,
// xom matnning o'zi ko'rsatiladi (hech bo'lmasa foydalanuvchi nimadir ko'radi).
const KNOWN_ERRORS = {
  "Avtorizatsiyadan o'tilmagan": 'errors.notAuthenticated',
  'Siz allaqachon bir kompaniyaga tegishlisiz': 'errors.alreadyBelongToCompany',
  "Taklif kodi noto'g'ri yoki muddati tugagan": 'errors.inviteInvalidOrExpired',
  'Telefon raqami taklif bilan mos kelmadi': 'errors.phoneMismatch',
  "PIN-kod 4 dan 6 tagacha raqamdan iborat bo'lishi kerak": 'errors.pinLength',
  "Juda ko'p noto'g'ri urinish. 5 daqiqadan so'ng qayta urinib ko'ring": 'errors.pinLocked',
  "Faqat kompaniya egasi rolni o'zgartira oladi": 'errors.ownerOnlyRole',
  'Xodim topilmadi': 'errors.employeeNotFound',
  "Faqat kompaniya egasi xodim holatini o'zgartira oladi": 'errors.ownerOnlyActive',
  'Profil topilmadi yoki faol emas': 'errors.profileInactive',
  "Bu ustunlarni faqat tizim funksiyalari orqali o'zgartirish mumkin": 'errors.protectedColumns',
  'Vazifa topilmadi': 'errors.taskNotFound',
  'Bu vazifa sizga tayinlanmagan': 'errors.taskNotAssigned',
  "Noto'g'ri holat qiymati": 'errors.invalidStatus',
  'Buyurtma topilmadi': 'errors.orderNotFound',
  "Miqdor musbat bo'lishi kerak": 'errors.quantityPositive',
  'Qurilma topilmadi': 'errors.deviceNotFound',
  "Faqat kompaniya egasi qurilmani bloklashi mumkin": 'errors.ownerOnlyDevice',
  'Kompaniya kodi topilmadi': 'errors.companyCodeNotFound',
  "Bu taklif kodi profil bilan bog'lanmagan": 'errors.inviteNotLinked',
  "PIN allaqachon o'rnatilgan": 'errors.pinAlreadySet',
  "PIN hali o'rnatilmagan": 'errors.pinNotSet',
  'Faqat kompaniya egasi narxni tasdiqlashi mumkin': 'errors.ownerOnlyPriceApproval',
  'Tavsiya topilmadi yoki allaqachon hal qilingan': 'errors.recommendationNotFound',
  'Faqat kompaniya egasi tavsiyani rad eta oladi': 'errors.ownerOnlyPriceReject',
  "Faqat egasi yoki menejer bashorat yarata oladi": 'errors.ownerManagerOnlyForecast',
  'Mahsulot topilmadi': 'errors.productNotFound',
  'Faqat kassir yoki kompaniya egasi kunni yopa oladi': 'errors.ownerCashierOnlyCloseDay',
  "Kelajakdagi kunni yopib bo'lmaydi": 'errors.futureDateClose',
  // Demo rejimidagi yozish urinishi — supabase klientidagi qo'riqchi
  // (src/lib/supabase.js) va bazadagi trigger ikkalasi ham shu xabarni
  // beradi, shuning uchun ikkala variant ham xaritalangan.
  DEMO_READ_ONLY: 'demo.readOnlyError',
  "Demo rejimida ma'lumotni o'zgartirib bo'lmaydi": 'demo.readOnlyError',
}

export function translateError(t, error) {
  const message = error?.message || ''
  const key = KNOWN_ERRORS[message]
  return key ? t(key) : message || t('common.genericError')
}
