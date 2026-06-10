import { BookingScreen } from "@/screens/BookingScreen.jsx";

export default async function BookingPage({ params }) {
  const { shopId } = await params;
  return <BookingScreen shopId={shopId} />;
}
