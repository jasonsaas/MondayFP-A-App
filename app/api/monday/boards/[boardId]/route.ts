import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { mondayBoards } from '@/db/schema/fpa';
import { MondayClient } from '@/lib/monday-client';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/monday/boards/[boardId]
 * Get detailed data for a specific Monday.com board including items and columns
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    // Get user's Monday.com access token
    const [userAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, userId))
      .limit(1);

    if (!userAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Monday.com not connected. Please sign in again.' },
        { status: 400 }
      );
    }

    // Fetch board data from Monday.com
    const mondayClient = new MondayClient(userAccount.accessToken);

    const [items, columns] = await Promise.all([
      mondayClient.getBoardItems(boardId),
      mondayClient.getBoardColumns(boardId)
    ]);

    // Check if board is saved in our database
    const [savedBoard] = await db
      .select()
      .from(mondayBoards)
      .where(and(
        eq(mondayBoards.mondayBoardId, boardId),
        eq(mondayBoards.userId, userId)
      ))
      .limit(1);

    return NextResponse.json({
      boardId,
      items,
      columns,
      itemCount: items.length,
      columnCount: columns.length,
      isSaved: !!savedBoard,
      savedBoard: savedBoard || null
    });

  } catch (error: any) {
    console.error('Error fetching board data:', error);

    // Handle specific Monday API errors
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch board data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monday/boards/[boardId]
 * Save/link a Monday.com board to the user's account for tracking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, workspaceId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      );
    }

    // Check if board is already saved
    const [existingBoard] = await db
      .select()
      .from(mondayBoards)
      .where(and(
        eq(mondayBoards.mondayBoardId, boardId),
        eq(mondayBoards.userId, userId)
      ))
      .limit(1);

    if (existingBoard) {
      // Update existing board
      const [updated] = await db
        .update(mondayBoards)
        .set({
          name,
          description,
          workspaceId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(mondayBoards.id, existingBoard.id))
        .returning();

      return NextResponse.json({
        message: 'Board updated successfully',
        board: updated
      });
    }

    // Create new board record
    const [newBoard] = await db
      .insert(mondayBoards)
      .values({
        id: crypto.randomUUID(),
        name,
        description,
        userId,
        mondayBoardId: boardId,
        workspaceId,
        isActive: true,
        lastSyncAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      message: 'Board saved successfully',
      board: newBoard
    }, { status: 201 });

  } catch (error) {
    console.error('Error saving board:', error);
    return NextResponse.json(
      { error: 'Failed to save board' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/monday/boards/[boardId]
 * Remove a board from tracking (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting isActive to false
    await db
      .update(mondayBoards)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(mondayBoards.mondayBoardId, boardId),
        eq(mondayBoards.userId, userId)
      ));

    return NextResponse.json({
      message: 'Board removed from tracking',
      boardId
    });

  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json(
      { error: 'Failed to remove board' },
      { status: 500 }
    );
  }
}