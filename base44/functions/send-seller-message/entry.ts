import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: "Authentication required" }, { status: 401 });

    const { conversationId, body } = await req.json();
    const text = String(body || "").trim();
    if (!conversationId || !text) return Response.json({ error: "Message is required" }, { status: 400 });
    if (text.length > 2000) return Response.json({ error: "Message is too long" }, { status: 400 });

    const conversations = await base44.asServiceRole.entities.SellerConversation.filter({ id: conversationId }, null, 1);
    const conversation = conversations?.[0];
    if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

    const isBuyer = conversation.buyer_email === user.email;
    const isSeller = conversation.seller_email === user.email;
    if (!isBuyer && !isSeller) return Response.json({ error: "Not authorised for this conversation" }, { status: 403 });

    const recipientEmail = isBuyer ? conversation.seller_email : conversation.buyer_email;
    const message = await base44.asServiceRole.entities.SellerMessage.create({
      conversation_id: conversation.id,
      sender_email: user.email,
      recipient_email: recipientEmail,
      body: text,
    });

    await base44.asServiceRole.entities.SellerConversation.update(conversation.id, {
      last_message: text,
      last_message_at: new Date().toISOString(),
      unread_for_buyer: isSeller,
      unread_for_seller: isBuyer,
    });

    return Response.json({ success: true, message });
  } catch (error) {
    console.error("sendSellerMessage failed", error);
    return Response.json({ error: error?.message || "Unable to send message" }, { status: 500 });
  }
});
