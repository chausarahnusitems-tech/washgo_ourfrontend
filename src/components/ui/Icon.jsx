import {
  Armchair,
  ArrowLeft,
  Calendar,
  Car,
  Check,
  Clock,
  Coins,
  Filter,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LocateFixed,
  MapPin,
  ReceiptText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  WalletCards
} from "lucide-react";

const icons = {
  Armchair,
  ArrowLeft,
  Calendar,
  Car,
  Check,
  Clock,
  Coins,
  Filter,
  Gift,
  Heart,
  HelpCircle,
  Home,
  LocateFixed,
  MapPin,
  ReceiptText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  WalletCards
};

export function Icon({ name, className = "", strokeWidth = 2 }) {
  const Component = icons[name] ?? Car;
  return <Component aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
