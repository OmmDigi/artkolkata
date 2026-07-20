const fs = require('fs');
const file = 'c:/Users/USER/Desktop/Debu/artkolkata/frontend/Component1/layout/Navbar.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const firstWordIndex = lines.findIndex(l => l.includes('const firstWord ='));
const nextIndex = lines.findIndex((l, i) => i > firstWordIndex && l.includes('? `${locationLabel} - ${postalCode}`'));

const missingBlock = `        postOffice.Name?.split(" ")[0] ||
        postOffice.Name ||
        postOffice.District ||
        "Location";
      setLocationLabel(firstWord);
      setPostalCode(pin);
      setLocationError("");
      setPinError("");
      setIsLocationModalOpen(false);
    } catch (error) {
      setPinError("Unable to fetch pin details. Please try again.");
    }
  };

  const handleLocationButton = () => {
    setPinError("");
    setIsLocationModalOpen(true);
  };

  const handlePinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pinInput.trim()) {
      setPinError("Enter a pin code.");
      return;
    }

    await fetchPinDetails(pinInput.trim());
  };

  const { wishlist } = useWishlistStore();

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 transition-colors duration-300 ease-in-out">
        {/* Top Ribbon (Mobile Only) */}
        <div className="md:hidden bg-[#cb2b2b] text-white text-[12px] py-[5px] px-[10px] text-center min-h-[28px] max-h-[35px] flex items-center justify-center w-full">
          <Link href="/product" className="tracking-[1.2px] hover:underline uppercase font-medium">
            {ribbonText}
            <span className="animate-pulse">|</span>
          </Link>
        </div>

        <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 relative">
          {/* Mobile Menu Button (Left on Mobile) */}
          <button
            className="md:hidden transition text-gray-700 hover:text-gray-900 z-10"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          {/* Logo */}
          <div className="flex items-center justify-center absolute inset-0 pointer-events-none md:static md:inset-auto md:justify-start md:pointer-events-auto md:gap-6">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900 transition pointer-events-auto"
            >
              <img
                src="/Art-Kolkata-Logo.png"
                alt="Art Kolkata Logo"
                className="h-16"
              />
            </Link>
            <div className="hidden lg:flex items-center gap-3 text-sm text-gray-700 pointer-events-auto">
              <MapPin size={18} className="text-orange-500" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Delivering to
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">`;

lines.splice(firstWordIndex + 1, nextIndex - firstWordIndex - 1, missingBlock);
fs.writeFileSync(file, lines.join('\n'));
console.log('File fixed successfully');
