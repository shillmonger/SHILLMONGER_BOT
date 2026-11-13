import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import TradeExecution from '@/models/TradeExecution';
import TelegramProvider from '@/models/TelegramProvider';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * GET /api/admin/trade-executions?status=&environment=&limit=500
 *
 * Every user's trade execution audit trail. Each row is joined to its
 * Telegram provider via chatId -> telegramproviders.groupId so the UI can
 * show which signal group the trade originated from.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10) || 500, 1), 2000);
    const status = searchParams.get('status');
    const environment = searchParams.get('environment');

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (environment === 'demo' || environment === 'live') query.environment = environment;

    const executions = await TradeExecution.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'userName email avatar')
      .lean();

    // Resolve the originating Telegram group for every execution.
    const chatIds = [...new Set(executions.map((e) => e.chatId).filter((c): c is number => typeof c === 'number'))];
    const providers = chatIds.length
      ? await TelegramProvider.find({ groupId: { $in: chatIds.map(String) } })
          .select('groupId groupName profileImage isActive')
          .lean()
      : [];
    const providerByChatId = new Map(providers.map((p) => [String(p.groupId), p]));

    return NextResponse.json({
      success: true,
      executions: executions.map((e) => {
        const user = e.userId as unknown as { _id?: unknown; userName?: string; email?: string; avatar?: string } | null;
        const provider = e.chatId != null ? providerByChatId.get(String(e.chatId)) ?? null : null;
        return {
          id: String(e._id),
          userId: user?._id ? String(user._id) : e.userId ? String(e.userId) : null,
          userName: user?.userName ?? null,
          userEmail: user?.email ?? null,
          userAvatar: user?.avatar ?? null,
          environment: e.environment ?? null,
          chatId: e.chatId ?? null,
          messageId: e.messageId ?? null,
          signalId: e.signalId ?? null,
          symbol: e.symbol ?? null,
          groupName: e.groupName ?? provider?.groupName ?? null,
          provider: provider
            ? {
                groupId: provider.groupId,
                groupName: provider.groupName,
                profileImage: provider.profileImage || null,
                isActive: provider.isActive,
              }
            : null,
          orderType: e.orderType ?? null,
          epic: e.epic ?? null,
          direction: e.direction ?? null,
          size: e.size ?? null,
          entryLevel: e.entryLevel ?? null,
          stopLevel: e.stopLevel ?? null,
          takeProfitLevel: e.takeProfitLevel ?? null,
          dealReference: e.dealReference ?? null,
          dealId: e.dealId ?? null,
          status: e.status ?? null,
          error: e.error ?? null,
          realizedPnl: e.realizedPnl ?? null,
          unrealizedPnl: e.unrealizedPnl ?? null,
          openedAt: e.openedAt ?? null,
          closedAt: e.closedAt ?? null,
          confirmedAt: e.confirmedAt ?? null,
          createdAt: e.createdAt ?? null,
          updatedAt: e.updatedAt ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('Admin trade-executions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch trade executions' }, { status: 500 });
  }
}
