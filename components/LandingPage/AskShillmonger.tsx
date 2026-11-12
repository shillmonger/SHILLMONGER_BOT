"use client";

import { motion } from "framer-motion";
import { Montserrat, IBM_Plex_Mono } from "next/font/google";
import { Bot, Mic, MessageSquare, BookOpen, Layers, Calculator } from "lucide-react";

const montserrat = Montserrat({
    subsets: ["latin"],
    weight: ["500", "600", "700", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
    weight: ["400", "500", "600"],
    subsets: ["latin"],
    display: "swap",
});

interface AskShillmongerProps {
    /** Hook these up to your real chat / voice assistant */
    onChatClick?: () => void;
    onTalkClick?: () => void;
}

const FEATURES = [
    { icon: BookOpen, label: "Bot rules explained in plain words" },
    { icon: Layers, label: "Plans and pricing side by side" },
    { icon: Calculator, label: "Lot size, risk & P&L worked out" },
];

const LANGUAGES = ["English", "Deutsch", "Español", "Français", "Português", "Bahasa Melayu", "日本語", "العربية"];

export default function AskShillmonger({ onChatClick, onTalkClick }: AskShillmongerProps) {
    return (
        <section
            id="ask-shillmonger"
            className="relative w-full overflow-hidden py-16 text-neutral-900 dark:text-white md:py-20"
        >

            {/* Full-width container */}
            <div className="relative z-10 w-full px-4 sm:px-6 lg:px-12">
                {/* Header */}
                <div className="mb-10 md:mb-10">
                    <p className={`${plexMono.className} text-[11px] tracking-[0.2em] text-violet-600 dark:text-violet-400`}>
                        [ // AI ASSISTANT ]
                    </p>
                    <h2
                        className={`${montserrat.className} mt-3 text-4xl font-extrabold tracking-tight md:text-6xl`}
                    >
                        Ask{" "}
                        <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400">
                            SHILLMONGER
                        </span>
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-white/60 md:text-lg">
                        SHILLMONGER knows every plan, rule and setting of the bot. Type a question or just talk. It answers in
                        seconds, in your language, any time of day.
                    </p>
                </div>

                {/* Main row */}
                <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch">
                    {/* ───────── Chat card ───────── */}
                    <div className="relative flex-1 overflow-hidden rounded-[1.75rem] border border-violet-500/20 bg-white shadow-2xl shadow-violet-900/10 dark:bg-white/[0.02] dark:shadow-black/50 p-5 md:p-8">
                        <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[100px]" />

                        <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
                            {/* Conversation */}
                            <div className="space-y-4">
                                {/* user 1 */}
                                <motion.div
                                    initial={{ opacity: 0, y: 14 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.45 }}
                                    className="flex justify-end"
                                >
                                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-900/40">
                                        Can I test the bot on a demo account first?
                                    </div>
                                </motion.div>

                                {/* bot 1 */}
                                <motion.div
                                    initial={{ opacity: 0, y: 14 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.45, delay: 0.5 }}
                                    className="flex items-start gap-3"
                                >
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                                        <Bot size={15} className="text-violet-600 dark:text-violet-300" />
                                    </div>
                                    <p className="max-w-[85%] text-sm leading-relaxed text-neutral-700 dark:text-white/80">
                                        <strong className="font-bold text-neutral-900 dark:text-white">Yes.</strong> We recommend starting on a Capital.com demo
                                        account so you can watch the bot trade XAUUSD before any real funds are involved.
                                    </p>
                                </motion.div>

                                {/* user 2 */}
                                <motion.div
                                    initial={{ opacity: 0, y: 14 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.45, delay: 1 }}
                                    className="flex justify-end"
                                >
                                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-900/40">
                                        What lot size risks $300 with a $5 stop on XAUUSD?
                                    </div>
                                </motion.div>

                                {/* bot 2 */}
                                <motion.div
                                    initial={{ opacity: 0, y: 14 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.45, delay: 1.5 }}
                                    className="flex items-start gap-3"
                                >
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                                        <Bot size={15} className="text-violet-600 dark:text-violet-300" />
                                    </div>
                                    <p className="max-w-[85%] text-sm leading-relaxed text-neutral-700 dark:text-white/80">
                                        <strong className="font-bold text-neutral-900 dark:text-white">About 0.60 lots</strong> on a 100 oz contract. Here's the
                                        working, so you can check it yourself.
                                    </p>
                                </motion.div>
                            </div>

                            {/* Position size card */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 1.7 }}
                                className="rounded-2xl border border-violet-500/20 bg-[#0d0b26] shadow-xl shadow-black/40"
                            >
                                <div className="border-b border-white/5 p-4">
                                    <p className={`${montserrat.className} text-xs font-bold`}>Position size</p>
                                    <p className={`${plexMono.className} mt-0.5 text-[10px] text-violet-300`}>XAUUSD · $300.00</p>
                                    <p className={`${plexMono.className} mt-3 text-[10px] text-white/50`}>Lot size</p>
                                    <p className={`${plexMono.className} text-3xl font-semibold text-white tracking-tight`}>0.60 lots</p>
                                </div>

                                <div className={`${plexMono.className} grid grid-cols-2 gap-3 border-b border-white/5 p-4 text-[10px]`}>
                                    <div>
                                        <p className="text-violet-300/80">Risk</p>
                                        <p className="mt-0.5 font-semibold">$300.00</p>
                                    </div>
                                    <div>
                                        <p className="text-violet-300/80">Stop ($ move)</p>
                                        <p className="mt-0.5 font-semibold">$5.00</p>
                                    </div>
                                    <div>
                                        <p className="text-violet-300/80">Value per $1</p>
                                        <p className="mt-0.5 font-semibold">$100.00</p>
                                    </div>
                                    <div>
                                        <p className="text-violet-300/80">Money at risk</p>
                                        <p className="mt-0.5 font-semibold">$300.00</p>
                                    </div>
                                </div>

                                <p className={`${plexMono.className} p-4 text-[10px] text-white/50`}>
                                    $300 ÷ ($5.00 × 100 oz) = 0.60 lots
                                </p>
                            </motion.div>
                        </div>

                        {/* Divider */}
                        <div className="relative my-7 h-px bg-neutral-200 dark:bg-white/10" />

                        {/* Features */}
                        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {FEATURES.map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-white/80">
                                    <Icon size={16} className="shrink-0 text-violet-600 dark:text-violet-400" />
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Languages */}
                        <div className="relative mt-5 flex flex-wrap items-center gap-2">
                            <span className="mr-1 text-[10px] font-semibold text-neutral-500 dark:text-white/50">Answers in</span>
                            {LANGUAGES.map((lang) => (
                                <span
                                    key={lang}
                                    className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[10px] font-medium text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                                >
                                    {lang}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* ───────── Talk pill ───────── */}
                    <motion.button
                        onClick={onTalkClick}
                        initial={{ opacity: 0, scale: 0.96 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-violet-500 via-violet-600 to-purple-700 px-8 py-12 shadow-[0_0_80px_rgba(139,92,246,0.35)] lg:w-[280px] lg:shrink-0 lg:rounded-[140px] lg:py-16"
                        aria-label="Talk to SHILLMONGER"
                    >
                        {/* Pulsing rings + mic */}
                        <div className="relative mb-8 flex h-36 w-36 items-center justify-center lg:mb-auto lg:mt-10">

                            {/* Continuous pulsing outer ring */}
                            <motion.span
                                animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className="absolute inset-0 rounded-full bg-white/10"
                            />

                            {/* Middle ring */}
                            <motion.span
                                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.2,
                                }}
                                className="absolute inset-3 rounded-full bg-white/10"
                            />

                            {/* Inner ring */}
                            <motion.span
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.4,
                                }}
                                className="absolute inset-7 rounded-full bg-white/15"
                            />

                            {/* Microphone */}
                            <motion.span
                                animate={{ scale: [1, 1.12, 1] }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-violet-900/40"
                            >
                                <Mic size={30} className="text-violet-600" />
                            </motion.span>

                        </div>

                        <div className="text-center lg:mt-12">
                            <p className={`${montserrat.className} text-2xl font-extrabold text-white leading-tight`}>
                                Talk to
                                <br />
                                SHILLMONGER
                            </p>
                            <p className="mt-3 text-xs font-medium text-white/80">
                                Ask out loud, hear the answer.
                            </p>
                        </div>
                    </motion.button>
                </div>
            </div>
        </section>
    );
}