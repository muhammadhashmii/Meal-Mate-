// Maps DB meal names to bundled images. Falls back to placeholder.
import chickenBiryani from "@/assets/chicken-biryani.jpg";
import zingerBurger from "@/assets/zinger-burger.jpg";
import pastaAlfredo from "@/assets/pasta-alfredo.jpg";
import chickenKarahi from "@/assets/chicken-karahi.jpg";
import friedEgg from "@/assets/fried-egg.jpg";
import clubSandwich from "@/assets/club-sandwich.jpg";
import samosa from "@/assets/samosa.jpg";
import caesarSalad from "@/assets/caesar-salad.jpg";
import rollParatha from "@/assets/roll-paratha.jpg";
import panini from "@/assets/panini.jpg";
import chickenTikka from "@/assets/chicken-tikka.jpg";

const map: Record<string, string> = {
  "Chicken Biryani": chickenBiryani,
  "Zinger Burger": zingerBurger,
  "Burger": zingerBurger,
  "Pasta Alfredo": pastaAlfredo,
  "Chicken Karahi": chickenKarahi,
  "Fried Egg on Toast": friedEgg,
  "Fried Egg": friedEgg,
  "Club Sandwich": clubSandwich,
  "Samosa": samosa,
  "Caesar Salad": caesarSalad,
  "Roll Paratha": rollParatha,
  "Panini": panini,
  "Chicken Tikka": chickenTikka,
};

export function imageForMeal(name: string, fallbackUrl?: string | null): string {
  return map[name] || fallbackUrl || "/placeholder.svg";
}

export const categoryEmoji: Record<string, string> = {
  Desi: "🍛",
  "Fast Food": "🍔",
  Italian: "🍝",
  Healthy: "🥗",
  Breakfast: "🍳",
};
