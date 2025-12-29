import { pgTable, foreignKey, serial, varchar, integer, bigint, doublePrecision, boolean, timestamp, jsonb, text, numeric, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const adStatus = pgEnum("ad_status", ['active', 'inactive', 'pending', 'expired'])
export const adType = pgEnum("ad_type", ['banner', 'carousel', 'popup', 'sidebar'])
export const carStatus = pgEnum("car_status", ['available', 'booked', 'maintenance', 'unavailable'])
export const fuelType = pgEnum("fuel_type", ['petrol', 'diesel', 'electric', 'hybrid'])
export const transmission = pgEnum("transmission", ['manual', 'automatic'])
export const userRole = pgEnum("user_role", ['user', 'admin', 'vendor', 'parkingincharge'])


export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: varchar(),
	avatar: varchar(),
	age: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	number: bigint({ mode: "number" }),
	email: varchar(),
	password: varchar().default('123456'),
	aadharNumber: varchar("aadhar_number"),
	aadharImg: varchar("aadhar_img"),
	dlNumber: varchar("dl_number"),
	dlImg: varchar("dl_img"),
	passportNumber: varchar("passport_number"),
	passportImg: varchar("passport_img"),
	lat: doublePrecision(),
	lng: doublePrecision(),
	locality: varchar(),
	city: varchar(),
	state: varchar(),
	country: varchar(),
	pincode: integer(),
	role: userRole().default('user'),
	isVerified: boolean("is_verified").default(false),
	parkingid: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.parkingid],
		foreignColumns: [parkings.id],
		name: "users_parkingid_parkings_id_fk"
	}).onDelete("cascade"),
]);

export const parkings = pgTable("parkings", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	locality: varchar(),
	city: varchar(),
	state: varchar(),
	country: varchar(),
	pincode: integer(),
	capacity: integer().notNull(),
	mainimg: varchar({ length: 255 }).notNull(),
	images: jsonb().notNull(),
	lat: doublePrecision().notNull(),
	lng: doublePrecision().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const review = pgTable("review", {
	id: serial().primaryKey().notNull(),
	carid: integer().notNull(),
	userid: integer().notNull(),
	rating: integer(),
	comment: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userid],
		foreignColumns: [users.id],
		name: "review_userid_users_id_fk"
	}).onDelete("cascade"),
]);

export const advertisements = pgTable("advertisements", {
	id: serial().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	imageUrl: varchar("image_url", { length: 500 }).notNull(),
	videoUrl: varchar("video_url", { length: 500 }),
	linkUrl: varchar("link_url", { length: 500 }),
	adType: adType("ad_type").default('banner').notNull(),
	status: adStatus().default('pending').notNull(),
	priority: integer().default(1).notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	clickCount: integer("click_count").default(0).notNull(),
	viewCount: integer("view_count").default(0).notNull(),
	targetAudience: varchar("target_audience", { length: 100 }),
	location: varchar({ length: 100 }),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "advertisements_created_by_users_id_fk"
	}).onDelete("cascade"),
]);

export const bookings = pgTable("bookings", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	carId: integer("car_id").notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	totalPrice: doublePrecision("total_price").notNull(),
	extensionPrice: doublePrecision("extension_price").default(0),
	status: varchar({ length: 50 }).default('pending'),
	pickupParkingId: integer("pickup_parking_id"),
	dropoffParkingId: integer("dropoff_parking_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	basePrice: doublePrecision("base_price").notNull(),
	advanceAmount: doublePrecision("advance_amount").notNull(),
	remainingAmount: doublePrecision("remaining_amount").notNull(),
	extensionTill: timestamp("extension_till", { mode: 'string' }),
	extensionTime: integer("extension_time"),
	confirmationStatus: varchar("confirmation_status", { length: 50 }).default('pending'),
	advancePaymentStatus: varchar("advance_payment_status", { length: 50 }).default('pending'),
	finalPaymentStatus: varchar("final_payment_status", { length: 50 }).default('pending'),
	advancePaymentReferenceId: varchar("advance_payment_reference_id", { length: 100 }),
	finalPaymentReferenceId: varchar("final_payment_reference_id", { length: 100 }),
	carConditionImages: varchar("car_condition_images", { length: 500 }).array().default([""]),
	toolImages: varchar("tool_images", { length: 500 }).array().default([""]),
	tools: varchar({ length: 500 }).array().default([""]),
	picApproved: boolean("pic_approved").default(false),
	picApprovedAt: timestamp("pic_approved_at", { mode: 'string' }),
	picApprovedBy: integer("pic_approved_by"),
	picComments: varchar("pic_comments", { length: 500 }),
	userConfirmed: boolean("user_confirmed").default(false),
	userConfirmedAt: timestamp("user_confirmed_at", { mode: 'string' }),
	deliveryType: varchar("delivery_type", { length: 50 }).default('pickup'),
	deliveryAddress: varchar("delivery_address", { length: 500 }),
	deliveryCharges: doublePrecision("delivery_charges").default(0),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	pickupDate: timestamp("pickup_date", { mode: 'string' }),
	actualPickupDate: timestamp("actual_pickup_date", { mode: 'string' }),
	originalPickupDate: timestamp("original_pickup_date", { mode: 'string' }),
	rescheduleCount: integer("reschedule_count").default(0),
	maxRescheduleCount: integer("max_reschedule_count").default(3),
	otpCode: varchar("otp_code", { length: 4 }),
	otpExpiresAt: timestamp("otp_expires_at", { mode: 'string' }),
	otpVerified: boolean("otp_verified").default(false),
	otpVerifiedAt: timestamp("otp_verified_at", { mode: 'string' }),
	otpVerifiedBy: integer("otp_verified_by"),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "bookings_user_id_users_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.carId],
		foreignColumns: [car.id],
		name: "bookings_car_id_car_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.pickupParkingId],
		foreignColumns: [parkings.id],
		name: "bookings_pickup_parking_id_parkings_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.dropoffParkingId],
		foreignColumns: [parkings.id],
		name: "bookings_dropoff_parking_id_parkings_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.picApprovedBy],
		foreignColumns: [users.id],
		name: "bookings_pic_approved_by_users_id_fk"
	}),
	foreignKey({
		columns: [table.otpVerifiedBy],
		foreignColumns: [users.id],
		name: "bookings_otp_verified_by_users_id_fk"
	}),
]);

export const bookingTopups = pgTable("booking_topups", {
	id: serial().primaryKey().notNull(),
	bookingId: integer("booking_id").notNull(),
	topupId: integer("topup_id").notNull(),
	appliedAt: timestamp("applied_at", { mode: 'string' }).notNull(),
	originalEndDate: timestamp("original_end_date", { mode: 'string' }).notNull(),
	newEndDate: timestamp("new_end_date", { mode: 'string' }).notNull(),
	amount: doublePrecision().notNull(),
	paymentStatus: varchar("payment_status", { length: 50 }).default('pending'),
	paymentReferenceId: varchar("payment_reference_id", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.bookingId],
		foreignColumns: [bookings.id],
		name: "booking_topups_booking_id_bookings_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.topupId],
		foreignColumns: [topups.id],
		name: "booking_topups_topup_id_topups_id_fk"
	}).onDelete("cascade"),
]);

export const topups = pgTable("topups", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: varchar({ length: 500 }),
	duration: integer().notNull(),
	price: doublePrecision().notNull(),
	category: varchar({ length: 50 }).default('extension'),
	isActive: boolean("is_active").default(true),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "topups_created_by_users_id_fk"
	}),
]);

export const picVerifications = pgTable("pic_verifications", {
	id: serial().primaryKey().notNull(),
	carId: integer("car_id").notNull(),
	parkingId: integer("parking_id").notNull(),
	picId: integer("pic_id").notNull(),
	status: varchar({ length: 50 }).default('pending'),
	verificationType: varchar("verification_type", { length: 50 }).notNull(),
	engineCondition: varchar("engine_condition", { length: 50 }),
	bodyCondition: varchar("body_condition", { length: 50 }),
	interiorCondition: varchar("interior_condition", { length: 50 }),
	tireCondition: varchar("tire_condition", { length: 50 }),
	rcVerified: boolean("rc_verified").default(false),
	insuranceVerified: boolean("insurance_verified").default(false),
	pollutionVerified: boolean("pollution_verified").default(false),
	verificationImages: varchar("verification_images", { length: 500 }).array().default([""]),
	picComments: text("pic_comments"),
	vendorFeedback: text("vendor_feedback"),
	verifiedAt: timestamp("verified_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
		columns: [table.carId],
		foreignColumns: [car.id],
		name: "pic_verifications_car_id_car_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.parkingId],
		foreignColumns: [parkings.id],
		name: "pic_verifications_parking_id_parkings_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.picId],
		foreignColumns: [users.id],
		name: "pic_verifications_pic_id_users_id_fk"
	}).onDelete("cascade"),
]);

export const carCatalog = pgTable("car_catalog", {
	id: serial().primaryKey().notNull(),
	carName: varchar("car_name", { length: 255 }).notNull(),
	carMaker: varchar("car_maker", { length: 255 }).notNull(),
	carModelYear: integer("car_model_year").notNull(),
	carVendorPrice: numeric("car_vendor_price", { precision: 10, scale: 2 }).notNull(),
	carPlatformPrice: numeric("car_platform_price", { precision: 10, scale: 2 }).notNull(),
	transmission: transmission().default('manual').notNull(),
	fuelType: fuelType("fuel_type").default('petrol').notNull(),
	seats: integer().default(5).notNull(),
	engineCapacity: varchar("engine_capacity", { length: 50 }),
	mileage: varchar({ length: 50 }),
	features: varchar({ length: 1000 }),
	imageUrl: varchar("image_url", { length: 500 }),
	isActive: boolean("is_active").default(true).notNull(),
	category: varchar({ length: 100 }).default('sedan'),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "car_catalog_created_by_users_id_fk"
	}).onDelete("cascade"),
]);

export const car = pgTable("car", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	price: integer().notNull(),
	inmaintainance: boolean().default(false).notNull(),
	isavailable: boolean().default(true).notNull(),
	images: varchar({ length: 255 }).array(),
	vendorid: integer().notNull(),
	parkingid: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	number: varchar({ length: 20 }).default('CAR-001').notNull(),
	discountprice: integer(),
	catalogId: integer("catalog_id"),
	status: carStatus().default('available').notNull(),
	insuranceAmount: numeric("insurance_amount", { precision: 10, scale: 2 }).default('500').notNull(),
	rcnumber: varchar({ length: 255 }),
	rcimg: varchar({ length: 255 }),
	pollutionimg: varchar({ length: 255 }),
	insuranceimg: varchar({ length: 255 }),
	color: varchar({ length: 255 }),
}, (table) => [
	foreignKey({
		columns: [table.vendorid],
		foreignColumns: [users.id],
		name: "car_vendorid_users_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.catalogId],
		foreignColumns: [carCatalog.id],
		name: "car_catalog_id_car_catalog_id_fk"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.parkingid],
		foreignColumns: [parkings.id],
		name: "car_parkingid_parkings_id_fk"
	}).onDelete("cascade"),
	unique("car_number_unique").on(table.number),
]);
