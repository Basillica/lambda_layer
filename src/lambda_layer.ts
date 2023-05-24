import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import { Credentials } from '@aws-sdk/client-sts'
import { AdaptiveRetryStrategy } from '@aws-sdk/middleware-retry'
// import { AdaptiveRetryStrategy } from '@aws-sdk/util-retry'
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

interface ClientParams {
    region: string,
    credentials?: {
        accessKeyId: string,
        secretAccessKey: string,
        sessionToken: string
    },
    retryStrategy?: any
}

/**
 * 
 * @param region 
 * @param clientType 
 * @param sessionCredentials 
 * @returns 
 */
function setupClient<Type>(region: string, clientType: new (params: ClientParams) => Type, sessionCredentials?: Credentials): Type {

    const MAXIMUM_RETRY_DELAY = 30 * 1000

    const delayDecider = (delayBase: number, attempts: number) =>
        Math.floor(Math.min(MAXIMUM_RETRY_DELAY, 2 ** attempts * delayBase))

    if (sessionCredentials) {
        return new clientType({
            region: region,
            credentials: {
                accessKeyId: sessionCredentials.AccessKeyId!,
                secretAccessKey: sessionCredentials.SecretAccessKey!,
                sessionToken: sessionCredentials.SessionToken!
            },
            retryStrategy: new AdaptiveRetryStrategy(() => Promise.resolve(10), { delayDecider })
        })
    }
    else {
        return new clientType({
            region: region,
            retryStrategy: new AdaptiveRetryStrategy(() => Promise.resolve(10), { delayDecider })
        })
    }
}


export class PDFGenerator {
    htmlfiles: string[]
    parsedfiles: string[] = [];
    parsecontents: string[] = [];
    parsefields: string[] = [];
    browser: any = null

    constructor(htmlfiles: string[]) {
        this.htmlfiles = htmlfiles
    }

    async getBrowser(): Promise<any> {
        return await puppeteer.launch()
    }

    async parsefiles() {
        for (let i = 0; i < this.htmlfiles.length; i++) {
            this.htmlfiles[i] = this.htmlfiles[i].replace(
                this.parsefields[i],
                this.parsecontents[i],
            )
        }
    }

    async generatePDF() {
        const browser = await puppeteer.launch();
        const pages = [];

        // Load and add content from each HTML template
        for (const htmlFile of this.htmlfiles) {
            const page = await browser.newPage();
            const content = fs.readFileSync(htmlFile, 'utf-8');

            // // Parse HTML and modify content dynamically
            const modifiedHTML = content?.replace(
                '{{ changeme }}',
                '<p>This is dynamically inserted content.</p>'
            );

            await page.setContent(modifiedHTML);
            // await page.addStyleTag({ content: fs.readFileSync('styles.css', 'utf-8') });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: false,
            });
            pages.push(pdfBuffer);
        }

        // Merge PDF files into a single PDF
        const mergedPdf = await this.mergePDFs(pages);

        // Save the merged PDF to a file
        fs.writeFileSync('output.pdf', mergedPdf);

        await browser.close();
    }


    async mergePDFs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
        const mergedPdf = await PDFDocument.create();

        for (const pdfBuffer of pdfBuffers) {
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((copiedPage) => mergedPdf.addPage(copiedPage));
        }

        const mergedPdfBytes = await mergedPdf.save();

        return mergedPdfBytes;
    }
}


export class S3Example {
    client: S3Client

    constructor(region: string, sessionCredentials?: Credentials) {
        this.client = setupClient(region, S3Client, sessionCredentials)
    }

    async getAllBucketNames(): Promise<string[]> {
        const bucketNames: string[] = []
        const buckets = (await this.client.send(new ListBucketsCommand({}))).Buckets

        if (!buckets) {
            return []
        }

        for (let bucket of buckets) {
            bucketNames.push(bucket.Name!)
        }

        return bucketNames
    }
}