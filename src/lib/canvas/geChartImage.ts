import { formatItemStackQuantity } from '@oldschoolgg/toolkit';

import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { CanvasModule } from '@/lib/canvas/CanvasModule.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

export interface GEPricePoint {
	label: string;
	value: number;
}

export async function createGEPriceChart({
	user,
	itemName,
	points
}: {
	user: MUser;
	itemName: string;
	points: GEPricePoint[];
}): Promise<Buffer> {
	await CanvasModule.waitTillReady();
	if (!bankImageTask.ready) {
		await bankImageTask.init();
	}

	const width = 560;
	const height = 330;
	const bankBackgroundId = Number(user.user.bankBackground ?? 1);
	const { sprite, uniqueSprite, background, backgroundImage } = bankImageTask.getBgAndSprite({
		bankBackgroundId
	});

	const isTransparent = Boolean(background.transparent);
	const canvas = new OSRSCanvas({ width, height, sprite });
	const ctx = canvas.ctx;

	if (isTransparent) {
		ctx.fillStyle = user.user.bank_bg_hex ?? '#1a1a1a';
		ctx.fillRect(0, 0, width, height);
	} else {
		const pattern = ctx.createPattern(sprite.repeatableBg, 'repeat');
		if (pattern) {
			ctx.fillStyle = pattern;
			ctx.fillRect(0, 0, width, height);
		}
		if (!uniqueSprite && backgroundImage) {
			ctx.drawImage(backgroundImage, 0, 0, width, height);
		}
	}

	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
	ctx.fillRect(0, 0, width, height);

	canvas.drawTitleText({
		text: `Price History: ${itemName}`,
		x: Math.floor(width / 2),
		y: 22,
		center: true
	});

	const padLeft = 64;
	const padRight = 22;
	const padTop = 36;
	const padBottom = 42;
	const plotX = padLeft;
	const plotY = padTop;
	const plotW = width - padLeft - padRight;
	const plotH = height - padTop - padBottom;

	ctx.fillStyle = 'rgba(12, 12, 12, 0.55)';
	ctx.fillRect(plotX, plotY, plotW, plotH);
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
	ctx.lineWidth = 1;
	ctx.strokeRect(plotX, plotY, plotW, plotH);

	const values = points.map(p => p.value);
	const rawMin = Math.min(...values);
	const rawMax = Math.max(...values);
	const minVal = rawMin === rawMax ? Math.max(0, rawMin * 0.9) : rawMin;
	const maxVal = rawMin === rawMax ? rawMax * 1.1 || 100 : rawMax;
	const range = Math.max(1, maxVal - minVal);

	const yTicks = 5;
	ctx.font = '12px OSRSFontCompact';
	ctx.textBaseline = 'middle';
	for (let i = 0; i <= yTicks; i++) {
		const ratio = i / yTicks;
		const y = plotY + plotH - ratio * plotH;
		const val = Math.round(minVal + ratio * range);

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
		ctx.beginPath();
		ctx.moveTo(plotX, y);
		ctx.lineTo(plotX + plotW, y);
		ctx.stroke();

		const label = formatItemStackQuantity(val);
		canvas.drawText({
			text: label,
			x: plotX - 6 - canvas.measureTextWidth(label),
			y: Math.round(y + 4),
			color: '#ffff00',
			font: 'Compact'
		});
	}

	const coords = points.map((p, idx) => {
		const x = points.length === 1 ? plotX + plotW / 2 : plotX + (idx / (points.length - 1)) * plotW;
		const y = plotY + plotH - ((p.value - minVal) / range) * plotH;
		return { x, y, label: p.label, value: p.value };
	});

	if (coords.length > 1) {
		ctx.beginPath();
		ctx.moveTo(coords[0].x, plotY + plotH);
		for (const pt of coords) {
			ctx.lineTo(pt.x, pt.y);
		}
		ctx.lineTo(coords[coords.length - 1].x, plotY + plotH);
		ctx.closePath();
		const grad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
		grad.addColorStop(0, 'rgba(0, 255, 128, 0.28)');
		grad.addColorStop(1, 'rgba(0, 255, 128, 0.02)');
		ctx.fillStyle = grad;
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(coords[0].x, coords[0].y);
		for (let i = 1; i < coords.length; i++) {
			ctx.lineTo(coords[i].x, coords[i].y);
		}
		ctx.strokeStyle = '#00ff80';
		ctx.lineWidth = 2;
		ctx.stroke();
	}

	ctx.fillStyle = '#ffff00';
	for (const pt of coords) {
		ctx.beginPath();
		ctx.arc(pt.x, pt.y, coords.length > 40 ? 2 : 3, 0, Math.PI * 2);
		ctx.fill();
	}

	const maxXLabels = Math.min(5, coords.length);
	if (maxXLabels > 0) {
		const step = maxXLabels === 1 ? 0 : (coords.length - 1) / (maxXLabels - 1);
		for (let i = 0; i < maxXLabels; i++) {
			const idx = Math.round(i * step);
			const pt = coords[idx];
			canvas.drawText({
				text: pt.label,
				x: Math.round(pt.x),
				y: plotY + plotH + 18,
				color: '#ffffff',
				font: 'Compact',
				center: true
			});
		}
	}

	if (!isTransparent) {
		canvas.drawBorder(sprite, background.name === 'Default');
	}

	return canvas.toScaledOutput(2);
}
