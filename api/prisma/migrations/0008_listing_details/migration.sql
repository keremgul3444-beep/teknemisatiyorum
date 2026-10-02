-- İlan formu: motor saati, bayrak, takas ve pazarlık bilgisi.
ALTER TABLE "Listing" ADD COLUMN     "engineHours" INTEGER,
ADD COLUMN     "flag" TEXT,
ADD COLUMN     "tradeIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "negotiable" BOOLEAN NOT NULL DEFAULT false;
