const { spawn } = require('child_process');
const { createProgressReporter } = require('./cli-progress');

const STEPS = [
    { name: 'Import GPX', command: ['npm', 'run', 'import:gpx'] },
    { name: 'Import user GPX', command: ['npm', 'run', 'import:user-gpx'] },
    { name: 'Backfill Tile17', command: ['npm', 'run', 'backfill:tile17'] }
];

function runStep(step, index, totalSteps, reporter) {
    return new Promise((resolve, reject) => {
        reporter.update(index, totalSteps, step.name);

        const child = spawn(step.command[0], step.command.slice(1), {
            stdio: 'inherit',
            shell: true
        });

        child.on('exit', code => {
            if (code === 0) {
                reporter.update(index + 1, totalSteps, `${step.name} done`);
                resolve();
                return;
            }

            reject(new Error(`${step.name} failed with exit code ${code}`));
        });

        child.on('error', reject);
    });
}

async function main() {
    const reporter = createProgressReporter('Refresh all');

    for (let index = 0; index < STEPS.length; index += 1) {
        await runStep(STEPS[index], index, STEPS.length, reporter);
    }

    reporter.finish('All tasks completed');
}

main().catch(error => {
    console.error(`Refresh failed: ${error.message}`);
    process.exitCode = 1;
});
