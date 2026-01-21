import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

// Import routers
import authRouter from "./modules/auth/authroutes";
import userRouter from "./modules/user/userroute";
import carRouter from "./modules/car/carroute";
import parkingRouter from "./modules/parking/parkingroute";
import reviewRouter from "./modules/review/reviewroutes";
import bookingRouter from "./modules/booking/bookingroute";
import advertisementRouter from "./modules/advertisement/advertisementroutes";
import carCatalogRouter from "./modules/car/carcatalogroutes";
import topupRouter from "./modules/booking/topuproutes";
import picRouter from "./modules/pic/picroutes";
import couponRouter from "./modules/coupon/couponroutes";
import paymentRouter from "./modules/payment/paymentroutes";
import adminRouter from "./modules/admin/adminroutes";
import adminCarsRouter from "./modules/admin/admincarsroutes";
import adminParkingRouter from "./modules/admin/adminparkingroutes";
import adminPaymentRouter from "./modules/admin/adminpaymentroutes";
import adminVendorRouter from "./modules/admin/adminvendorroutes";
import carRequestRouter from "./modules/car/carrequest.routes";

// Import error handling utilities
import {
  errorHandler,
  notFoundHandler,
  gracefulShutdown,
  handleUnhandledRejection,
  handleUncaughtException,
} from "./modules/utils/errorHandler";
import { responseHandlerMiddleware } from "./modules/utils/responseHandler";

dotenv.config();

const app: Application = express();

app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000", "https://advv2-admin.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 1000, // 1 sec
  //15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Response handler middleware
app.use(responseHandlerMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Add request ID to headers for tracking
  req.headers["x-request-id"] = requestId;

  // Log request
  console.log(
    `📥 [${requestId}] ${req.method} ${req.path} - ${new Date().toISOString()}`
  );
  console.log(`📥 [${requestId}] Headers:`, {
    "user-agent": req.get("User-Agent"),
    "content-type": req.get("Content-Type"),
    authorization: req.get("Authorization") ? "Bearer ***" : "none",
  });

  // Add error handling for response
  res.on("error", (error) => {
    console.error(`❌ [${requestId}] Response error:`, error);
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji =
      status >= 200 && status < 300
        ? "✅"
        : status >= 400 && status < 500
          ? "⚠️"
          : "❌";

    console.log(
      `${statusEmoji} [${requestId}] ${req.method} ${req.path} - ${status} (${duration}ms)`
    );
  });

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/cars", carRouter);
app.use("/api/v1/parking", parkingRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/booking", bookingRouter);
app.use("/api/v1/advertisements", advertisementRouter);
app.use("/api/v1/car-catalog", carCatalogRouter);
app.use("/api/v1/topups", topupRouter);
app.use("/api/v1/pic", picRouter);
app.use("/api/v1/coupons", couponRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/admin/cars", adminCarsRouter);
app.use("/api/v1/admin/parking", adminParkingRouter);
app.use("/api/v1/admin/payments", adminPaymentRouter);
app.use("/api/v1/admin/vendors", adminVendorRouter);
app.use("/api/v1/car-request", carRequestRouter);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5500;

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown handlers
process.on("SIGTERM", gracefulShutdown(server));
process.on("SIGINT", gracefulShutdown(server));

// Unhandled rejection handler
process.on("unhandledRejection", handleUnhandledRejection);

// Uncaught exception handler
process.on("uncaughtException", handleUncaughtException);

// Export for testing
export default app;
