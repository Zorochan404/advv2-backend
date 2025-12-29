import { relations } from "drizzle-orm/relations";
import { parkings, users, review, advertisements, bookings, car, bookingTopups, topups, picVerifications, carCatalog } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	parking: one(parkings, {
		fields: [users.parkingid],
		references: [parkings.id]
	}),
	reviews: many(review),
	advertisements: many(advertisements),
	bookings_userId: many(bookings, {
		relationName: "bookings_userId_users_id"
	}),
	bookings_picApprovedBy: many(bookings, {
		relationName: "bookings_picApprovedBy_users_id"
	}),
	bookings_otpVerifiedBy: many(bookings, {
		relationName: "bookings_otpVerifiedBy_users_id"
	}),
	topups: many(topups),
	picVerifications: many(picVerifications),
	carCatalogs: many(carCatalog),
	cars: many(car),
}));

export const parkingsRelations = relations(parkings, ({many}) => ({
	users: many(users),
	bookings_pickupParkingId: many(bookings, {
		relationName: "bookings_pickupParkingId_parkings_id"
	}),
	bookings_dropoffParkingId: many(bookings, {
		relationName: "bookings_dropoffParkingId_parkings_id"
	}),
	picVerifications: many(picVerifications),
	cars: many(car),
}));

export const reviewRelations = relations(review, ({one}) => ({
	user: one(users, {
		fields: [review.userid],
		references: [users.id]
	}),
}));

export const advertisementsRelations = relations(advertisements, ({one}) => ({
	user: one(users, {
		fields: [advertisements.createdBy],
		references: [users.id]
	}),
}));

export const bookingsRelations = relations(bookings, ({one, many}) => ({
	user_userId: one(users, {
		fields: [bookings.userId],
		references: [users.id],
		relationName: "bookings_userId_users_id"
	}),
	car: one(car, {
		fields: [bookings.carId],
		references: [car.id]
	}),
	parking_pickupParkingId: one(parkings, {
		fields: [bookings.pickupParkingId],
		references: [parkings.id],
		relationName: "bookings_pickupParkingId_parkings_id"
	}),
	parking_dropoffParkingId: one(parkings, {
		fields: [bookings.dropoffParkingId],
		references: [parkings.id],
		relationName: "bookings_dropoffParkingId_parkings_id"
	}),
	user_picApprovedBy: one(users, {
		fields: [bookings.picApprovedBy],
		references: [users.id],
		relationName: "bookings_picApprovedBy_users_id"
	}),
	user_otpVerifiedBy: one(users, {
		fields: [bookings.otpVerifiedBy],
		references: [users.id],
		relationName: "bookings_otpVerifiedBy_users_id"
	}),
	bookingTopups: many(bookingTopups),
}));

export const carRelations = relations(car, ({one, many}) => ({
	bookings: many(bookings),
	picVerifications: many(picVerifications),
	user: one(users, {
		fields: [car.vendorid],
		references: [users.id]
	}),
	carCatalog: one(carCatalog, {
		fields: [car.catalogId],
		references: [carCatalog.id]
	}),
	parking: one(parkings, {
		fields: [car.parkingid],
		references: [parkings.id]
	}),
}));

export const bookingTopupsRelations = relations(bookingTopups, ({one}) => ({
	booking: one(bookings, {
		fields: [bookingTopups.bookingId],
		references: [bookings.id]
	}),
	topup: one(topups, {
		fields: [bookingTopups.topupId],
		references: [topups.id]
	}),
}));

export const topupsRelations = relations(topups, ({one, many}) => ({
	bookingTopups: many(bookingTopups),
	user: one(users, {
		fields: [topups.createdBy],
		references: [users.id]
	}),
}));

export const picVerificationsRelations = relations(picVerifications, ({one}) => ({
	car: one(car, {
		fields: [picVerifications.carId],
		references: [car.id]
	}),
	parking: one(parkings, {
		fields: [picVerifications.parkingId],
		references: [parkings.id]
	}),
	user: one(users, {
		fields: [picVerifications.picId],
		references: [users.id]
	}),
}));

export const carCatalogRelations = relations(carCatalog, ({one, many}) => ({
	user: one(users, {
		fields: [carCatalog.createdBy],
		references: [users.id]
	}),
	cars: many(car),
}));