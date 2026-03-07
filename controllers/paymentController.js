// after cart is done
// import razorpay from "../services/razorpayService.js";

// export const createOrder = async (req, res) => {
//   try {

//     const { amount } = req.body;

//     const options = {
//       amount: amount * 100, // Razorpay uses paise
//       currency: "INR",
//       receipt: "receipt_" + Date.now()
//     };

//     const order = await razorpay.orders.create(options);

//     res.status(200).json({
//       success: true,
//       order
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };