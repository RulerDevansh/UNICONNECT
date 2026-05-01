import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatWithAssistant } from '../services/assistantService';
import assistantLauncher from '../assets/assistant-launcher.svg';

const STARTER_MESSAGE = {
	role: 'assistant',
	content: 'Hi! I can help with app usage, listing discovery, and support guidance. Ask me anything.',
	ts: Date.now(),
};

const AIAssistantWidget = () => {
	const { isAuthenticated, loading } = useAuth();
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState([STARTER_MESSAGE]);
	const [loadingReply, setLoadingReply] = useState(false);
	const [error, setError] = useState('');
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const bottomRef = useRef(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, open, loadingReply]);

	const requestHistory = useMemo(
		() =>
			messages
				.slice(-12)
				.filter((m) => m.role === 'assistant' || m.role === 'user')
				.map((m) => ({ role: m.role, content: m.content })),
		[messages]
	);

	const sendMessage = async () => {
		const content = input.trim();
		if (!content || loadingReply) return;

		const userMessage = { role: 'user', content, ts: Date.now() };
		setMessages((prev) => [...prev, userMessage]);
		setInput('');
		setError('');
		setLoadingReply(true);

		try {
			const { data } = await chatWithAssistant({
				message: content,
				history: requestHistory,
			});

			const assistantMessage = {
				role: 'assistant',
				content: data?.reply || 'I could not generate a response right now.',
				listings: Array.isArray(data?.listings) ? data.listings : [],
				shares: Array.isArray(data?.shares) ? data.shares : [],
				ts: Date.now(),
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (err) {
			const apiMessage = err?.response?.data?.message;
			setError(apiMessage || 'Assistant is unavailable right now. Please try again.');
		} finally {
			setLoadingReply(false);
		}
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		await sendMessage();
	};

	const clearConversation = () => {
		setMessages([{ ...STARTER_MESSAGE, ts: Date.now() }]);
		setError('');
		setInput('');
		setShowClearConfirm(false);
	};

	if (loading || !isAuthenticated) return null;

	return (
		<>
			{!open && (
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-label="Open assistant"
					title="Open AI Assistant"
					className="fixed bottom-4 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full border border-brand-primary/70 bg-white p-0 shadow-lg shadow-brand-primary/30 transition hover:scale-105"
				>
					<img src={assistantLauncher} alt="AI bot" className="h-12 w-12 rounded-full object-cover" />
				</button>
			)}

			{open && (
				<div className="fixed bottom-4 right-4 z-40 flex h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl shadow-black/40 sm:h-[560px] sm:max-w-md">
					<div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
						<div>
							<p className="text-sm font-semibold text-slate-100">AI Assistant</p>
							<p className="text-xs text-slate-400">Session-only chat</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setShowClearConfirm(true)}
								className="h-8 min-w-8 rounded border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={() => setOpen(false)}
								aria-label="Close assistant"
								className="h-8 min-w-8 rounded border border-slate-700 px-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
							>
								X
							</button>
						</div>
					</div>

					{showClearConfirm && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 p-4">
							<div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
								<p className="text-sm font-medium text-slate-100">Clear this conversation?</p>
								<p className="mt-1 text-xs text-slate-400">This will remove current chat messages from the widget.</p>
								<div className="mt-4 flex justify-end gap-2">
									<button
										type="button"
										onClick={() => setShowClearConfirm(false)}
										className="h-8 rounded border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={clearConversation}
										className="h-8 rounded border border-rose-700 bg-rose-900/40 px-3 text-xs text-rose-200 hover:bg-rose-900/60"
									>
										Clear chat
									</button>
								</div>
							</div>
						</div>
					)}

					<div className="flex-1 space-y-3 overflow-y-auto p-3">
						{messages.map((message, idx) => (
							<div key={`${message.ts}-${idx}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
								<div
									className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
										message.role === 'user' ? 'bg-brand-primary text-white' : 'bg-slate-800 text-slate-100'
									}`}
								>
									<p>{message.content}</p>
									{Array.isArray(message.listings) && message.listings.length > 0 && (
										<div className="mt-2 space-y-2">
											{message.listings.slice(0, 3).map((item) => (
												<a
													key={item.id}
													href={`/listings/${item.id}`}
													aria-label={`Open ${item.title} listing`}
													className="block rounded border border-slate-600 bg-slate-900/70 p-2 text-xs text-slate-200 transition hover:border-brand-primary hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/70"
												>
													<div className="flex items-center gap-2">
														{item.image && (
															<img
																src={item.image}
																alt=""
																className="h-10 w-10 flex-none rounded object-cover"
																loading="lazy"
															/>
														)}
														<div className="min-w-0">
															<p className="truncate font-medium text-slate-100">{item.title}</p>
															<p>{item.category} • INR {item.price}</p>
														</div>
													</div>
												</a>
											))}
										</div>
									)}
									{Array.isArray(message.shares) && message.shares.length > 0 && (
										<div className="mt-2 space-y-2">
											{message.shares.slice(0, 3).map((item) => (
												<a
													key={item.id}
													href="/shares"
													aria-label={`Open ${item.name} sharing option`}
													className="block rounded border border-cyan-700/60 bg-cyan-950/40 p-2 text-xs text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-950/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
												>
													<p className="font-medium text-cyan-50">{item.name}</p>
													<p>{item.shareType} • INR {item.totalAmount}</p>
													{item.route && <p>{item.route}</p>}
													{item.foodItems && <p>{item.foodItems}</p>}
													{item.productName && <p>{item.productName}</p>}
												</a>
											))}
										</div>
									)}
								</div>
							</div>
						))}

						{loadingReply && (
							<div className="flex justify-start">
								<p className="rounded-2xl bg-slate-800 px-3 py-2 text-sm text-slate-300">Thinking...</p>
							</div>
						)}

						{error && <p className="text-xs text-rose-300">{error}</p>}
						<div ref={bottomRef} />
					</div>

					<form onSubmit={handleSubmit} className="border-t border-slate-800 p-3">
						<div className="flex gap-2">
							<input
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder="Ask about listings, bidding, safety..."
								className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
								maxLength={1200}
							/>
							<button
								type="submit"
								disabled={loadingReply || !input.trim()}
								className="rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
							>
								Send
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
};

export default AIAssistantWidget;
