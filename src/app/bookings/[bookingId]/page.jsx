import { BookingDetailScreen } from "@/screens/BookingDetailScreen.jsx";

export default async function BookingDetailPage({ params }) {
  const { bookingId } = await params;
  return <BookingDetailScreen bookingId={bookingId} />;
}
