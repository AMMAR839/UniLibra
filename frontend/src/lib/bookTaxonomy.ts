export const bookCategoryThemes = {
  Pendidikan: [
    "Fisika",
    "Kimia",
    "Biologi",
    "Matematika",
    "Sejarah",
    "Ekonomi",
    "Bahasa",
    "Geografi",
  ],
  Komik: [
    "Adventure",
    "Romance",
    "Action",
    "Comedy",
    "Fantasy",
    "Slice of life",
    "Superhero",
    "Misteri",
  ],
  Novel: [
    "Adventure",
    "Romance",
    "Fantasi",
    "Misteri",
    "Drama",
    "Sejarah",
    "Keluarga",
    "Thriller",
  ],
  Teknologi: [
    "Pemrograman",
    "AI",
    "Data science",
    "Database",
    "Jaringan",
    "UI/UX",
    "Cybersecurity",
  ],
  Bisnis: [
    "Startup",
    "Marketing",
    "Manajemen",
    "Keuangan",
    "Investasi",
    "Kewirausahaan",
  ],
  "Pengembangan diri": [
    "Produktivitas",
    "Kebiasaan",
    "Psikologi",
    "Karier",
    "Komunikasi",
    "Mindset",
  ],
  Sastra: [
    "Puisi",
    "Cerpen",
    "Kritik sastra",
    "Klasik",
    "Budaya",
    "Drama",
  ],
  Nonfiksi: [
    "Biografi",
    "Memoar",
    "Sejarah",
    "Sains populer",
    "Esai",
    "Sosial",
  ],
} as const;

export const bookCategories = Object.keys(bookCategoryThemes);

export function themesForCategory(category: string) {
  return bookCategoryThemes[category as keyof typeof bookCategoryThemes] ?? [];
}

export function allBookThemes() {
  return Array.from(new Set(Object.values(bookCategoryThemes).flat())).sort();
}
