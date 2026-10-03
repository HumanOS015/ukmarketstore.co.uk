import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Account deletion / data cleanup. Called by the authenticated user from the
// Profile and mobile Account screens. Removes the user's marketplace data
// (active listings set to "removed", wishlist, saved searches, notifications,
// reviews, and their buying conversations) using the service role, since some
// of these (e.g. Review delete) are admin-only under RLS. Orders are retained
// for financial record-keeping. The frontend then signs the user out.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const email = user.email;

    const svc = base44.asServiceRole.entities;

    const listings = await svc.Product.updateMany(
      { seller_email: email, status: 'active' },
      { $set: { status: 'removed' } }
    ).catch((e) => { console.warn('Product cleanup failed', e); return { updated: 0 }; });

    const wishlist = await svc.Wishlist.deleteMany({ buyer_email: email })
      .catch((e) => { console.warn('Wishlist cleanup failed', e); return { deleted: 0 }; });

    const searches = await svc.SavedSearch.deleteMany({ buyer_email: email })
      .catch((e) => { console.warn('SavedSearch cleanup failed', e); return { deleted: 0 }; });

    const notifs = await svc.Notification.deleteMany({ user_email: email })
      .catch((e) => { console.warn('Notification cleanup failed', e); return { deleted: 0 }; });

    const reviews = await svc.Review.deleteMany({ buyer_email: email })
      .catch((e) => { console.warn('Review cleanup failed', e); return { deleted: 0 }; });

    const conversations = await svc.SellerConversation.deleteMany({ buyer_email: email })
      .catch((e) => { console.warn('Conversation cleanup failed', e); return { deleted: 0 }; });

    return Response.json({
      ok: true,
      email,
      removed_listings: listings?.updated ?? 0,
      deleted_wishlist: wishlist?.deleted ?? 0,
      deleted_searches: searches?.deleted ?? 0,
      deleted_notifications: notifs?.deleted ?? 0,
      deleted_reviews: reviews?.deleted ?? 0,
      deleted_conversations: conversations?.deleted ?? 0,
    });
  } catch (error) {
    console.error("deleteAccount error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}