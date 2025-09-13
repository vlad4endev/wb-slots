import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateTokenSchema } from '@/lib/validation';
import { encrypt, maskToken } from '@/lib/encryption';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: tokenId } = await params;
    const body = await request.json();
    const validatedData = updateTokenSchema.parse(body);

    // Check if token exists and belongs to user
    const existingToken = await prisma.userToken.findFirst({
      where: {
        id: tokenId,
        userId: user.id,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (validatedData.token) {
      updateData.tokenEncrypted = encrypt(validatedData.token);
    }
    
    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
    }

    // Update token
    const token = await prisma.userToken.update({
      where: { id: tokenId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { 
        token: {
          ...token,
          tokenEncrypted: maskToken(token.tokenEncrypted),
        }
      },
      message: 'Token updated successfully',
    });
  } catch (error) {
    console.error('Update token error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: tokenId } = await params;

    // Check if token exists and belongs to user
    const existingToken = await prisma.userToken.findFirst({
      where: {
        id: tokenId,
        userId: user.id,
      },
    });

    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    // Delete token
    await prisma.userToken.delete({
      where: { id: tokenId },
    });

    return NextResponse.json({
      success: true,
      message: 'Token deleted successfully',
    });
  } catch (error) {
    console.error('Delete token error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
