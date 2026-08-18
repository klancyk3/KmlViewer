function formatPercent(current, total) {
    if (!Number.isFinite(total) || total <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

function renderBar(percent, width = 24) {
    const safePercent = Math.max(0, Math.min(100, percent));
    const filled = Math.round((safePercent / 100) * width);
    return `${'#'.repeat(filled)}${'-'.repeat(width - filled)}`;
}

function createProgressReporter(label) {
    let lastLineLength = 0;
    let finished = false;

    function writeLine(line) {
        if (process.stdout.isTTY) {
            const paddedLine = line.padEnd(lastLineLength, ' ');
            process.stdout.write(`\r${paddedLine}`);
            lastLineLength = paddedLine.length;
            return;
        }

        console.log(line);
    }

    return {
        update(current, total, detail = '') {
            if (finished) {
                return;
            }

            const percent = formatPercent(current, total);
            const prefix = `${label} ${String(percent).padStart(3, ' ')}%`;
            const counts = Number.isFinite(total) && total > 0 ? ` (${current}/${total})` : '';
            const suffix = detail ? ` ${detail}` : '';
            const line = `${prefix} [${renderBar(percent)}]${counts}${suffix}`;
            writeLine(line);
        },
        finish(detail = 'Done') {
            if (finished) {
                return;
            }

            finished = true;
            const line = `${label} 100% [${renderBar(100)}] ${detail}`;
            if (process.stdout.isTTY) {
                const paddedLine = line.padEnd(lastLineLength, ' ');
                process.stdout.write(`\r${paddedLine}\n`);
            } else {
                console.log(line);
            }
        }
    };
}

module.exports = { createProgressReporter };
