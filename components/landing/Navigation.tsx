"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap-config";
import { Menu, X, ArrowRight } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useScrollTo } from "@/providers/LenisProvider";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

export function Navigation() {
  const navRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollTo = useScrollTo();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useGSAP(
    () => {
      if (!navRef.current) return;

      gsap.fromTo(
        navRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.3 }
      );

      gsap.fromTo(
        ".nav-item",
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, delay: 0.5 }
      );
    },
    { scope: navRef }
  );

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    if (href.startsWith("#")) {
      scrollTo(href);
    }
  };

  return (
    <>
      {/* Floating Capsule Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
        <nav
          ref={navRef}
          className={cn(
            "mx-auto w-fit",
            "h-12 px-2 pl-5",
            "flex items-center gap-1",
            "rounded-full",
            "border border-border/50",
            "shadow-lg shadow-black/5",
            "transition-all duration-300",
            isScrolled
              ? "bg-background/95 backdrop-blur-xl"
              : "bg-background/80 backdrop-blur-md"
          )}
        >
          {/* Logo */}
          <Link
            href="/"
            className="nav-item text-xl font-extrabold text-foreground tracking-tight hover:text-primary transition-colors"
          >
            levvl
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Links */}
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="nav-item px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
              >
                {link.label}
              </button>
            ))}
            <Link
              href="/login"
              className="nav-item px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-full hover:bg-muted/50"
            >
              Login
            </Link>

            {/* Theme Toggle */}
            <div className="nav-item mx-2">
              <AnimatedThemeToggler />
            </div>

            {/* CTA Button */}
            <button
              onClick={() => (window.location.href = "/login")}
              className="nav-item h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-full transition-all hover:shadow-md flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <AnimatedThemeToggler className="nav-item" />
            <button
              className="nav-item p-2.5 text-foreground hover:text-primary transition-colors rounded-full hover:bg-muted/50"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/98 backdrop-blur-xl transition-all duration-300 md:hidden",
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
          {navLinks.map((link, i) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className={cn(
                "text-2xl font-semibold text-foreground hover:text-primary transition-all",
                isMobileMenuOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
              style={{
                transitionDelay: isMobileMenuOpen ? `${100 + i * 50}ms` : "0ms",
              }}
            >
              {link.label}
            </button>
          ))}
          <Link
            href="/login"
            className={cn(
              "text-2xl font-semibold text-foreground hover:text-primary transition-all",
              isMobileMenuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            )}
            style={{
              transitionDelay: isMobileMenuOpen ? "200ms" : "0ms",
            }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Login
          </Link>
          <button
            className={cn(
              "mt-6 h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold rounded-full transition-all flex items-center gap-2 hover:shadow-lg",
              isMobileMenuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            )}
            style={{
              transitionDelay: isMobileMenuOpen ? "250ms" : "0ms",
            }}
            onClick={() => (window.location.href = "/login")}
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
