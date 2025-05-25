import { parse } from 'csv-parse/sync';
import { db } from './db';
import { filmmakerContacts } from '@shared/schema';
import { sendFilmmakerInvitation } from './email';

/**
 * Process a CSV file containing filmmaker information
 * @param csvContent The content of the CSV file as a string
 * @returns Information about the processed data
 */
export async function processFilmmakerCsv(csvContent: string): Promise<{
  totalProcessed: number;
  newContacts: number;
  updatedContacts: number;
  errors: string[];
}> {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let totalProcessed = 0;
    let newContacts = 0;
    let updatedContacts = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        // Try to map FilmFreeway fields to our schema
        // Adapt these mappings based on the actual structure of your CSV
        const filmmakerData = {
          name: record.name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
          email: record.email?.toLowerCase(),
          filmTitle: record.film_title || record.project_title || record.title,
          filmCategory: record.category || record.project_category,
          submissionYear: parseInt(record.year || record.submission_year) || new Date().getFullYear(),
          filmFestivalYear: parseInt(record.festival_year) || new Date().getFullYear(),
          additionalInfo: {
            originalRecord: record,
            timeOfSubmission: record.submission_date || record.created_at,
            status: record.status || 'imported',
            origin: 'FilmFreeway CSV Import',
          },
          tags: ['FilmFreeway', 'Import', new Date().getFullYear().toString()],
        };

        // Validate required fields
        if (!filmmakerData.email) {
          throw new Error('Email is required');
        }

        if (!filmmakerData.name) {
          filmmakerData.name = filmmakerData.email.split('@')[0]; // Use part of email as name if missing
        }

        // Check if filmmaker already exists in database
        const existingFilmmakers = await db.select()
          .from(filmmakerContacts)
          .where(filmmakerContacts.email === filmmakerData.email);

        if (existingFilmmakers.length === 0) {
          // Insert new filmmaker
          await db.insert(filmmakerContacts).values({
            ...filmmakerData,
            dateAdded: new Date(),
          });
          newContacts++;
        } else {
          // Update existing filmmaker with new information
          // This is optional - you might want to keep original info in some cases
          await db.update(filmmakerContacts)
            .set({
              filmTitle: filmmakerData.filmTitle || existingFilmmakers[0].filmTitle,
              filmCategory: filmmakerData.filmCategory || existingFilmmakers[0].filmCategory,
              submissionYear: filmmakerData.submissionYear || existingFilmmakers[0].submissionYear,
              filmFestivalYear: filmmakerData.filmFestivalYear || existingFilmmakers[0].filmFestivalYear,
              additionalInfo: {
                ...existingFilmmakers[0].additionalInfo,
                ...filmmakerData.additionalInfo,
              },
            })
            .where(filmmakerContacts.email === filmmakerData.email);
          updatedContacts++;
        }

        totalProcessed++;
      } catch (error: any) {
        const errorMessage = `Error processing record: ${error.message}`;
        console.error(errorMessage, record);
        errors.push(errorMessage);
      }
    }

    return {
      totalProcessed,
      newContacts,
      updatedContacts,
      errors,
    };
  } catch (error: any) {
    console.error('Error parsing CSV:', error);
    throw new Error(`Failed to process CSV: ${error.message}`);
  }
}

/**
 * Send invitation emails to filmmakers
 */
export async function sendInvitationsToFilmmakers(
  filmmakerIds: number[],
  sentBy: number
): Promise<{
  totalSent: number;
  failed: number;
  details: Array<{ id: number; email: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ id: number; email: string; success: boolean; error?: string }> = [];
  let totalSent = 0;
  let failed = 0;

  // Get filmmaker data from database
  const filmmakers = await db.select()
    .from(filmmakerContacts)
    .where(filmmakerContacts.id.in(filmmakerIds));

  // Process in batches to avoid overloading the email system
  const batchSize = 20;
  for (let i = 0; i < filmmakers.length; i += batchSize) {
    const batch = filmmakers.slice(i, i + batchSize);

    // Send emails in parallel within the batch
    const batchPromises = batch.map(async (filmmaker) => {
      try {
        // Skip if already invited (optional - you might want to resend sometimes)
        if (filmmaker.invitationSent) {
          // Update the invitation count
          await db.update(filmmakerContacts)
            .set({
              invitationCount: (filmmaker.invitationCount || 0) + 1,
              lastInvitationSentAt: new Date(),
            })
            .where(filmmakerContacts.id === filmmaker.id);
        }

        // Send the invitation email
        const result = await sendFilmmakerInvitation({
          to: filmmaker.email,
          name: filmmaker.name,
          filmTitle: filmmaker.filmTitle,
          sentBy,
        });

        if (result.success) {
          // Update the database to mark invitation as sent
          await db.update(filmmakerContacts)
            .set({
              invitationSent: true,
              invitationSentAt: filmmaker.invitationSentAt || new Date(),
              lastInvitationSentAt: new Date(),
              invitationCount: (filmmaker.invitationCount || 0) + 1,
            })
            .where(filmmakerContacts.id === filmmaker.id);

          totalSent++;
          results.push({ id: filmmaker.id, email: filmmaker.email, success: true });
        } else {
          failed++;
          results.push({
            id: filmmaker.id,
            email: filmmaker.email,
            success: false,
            error: result.error?.message || 'Failed to send invitation',
          });
        }
      } catch (error: any) {
        failed++;
        results.push({
          id: filmmaker.id,
          email: filmmaker.email,
          success: false,
          error: error.message,
        });
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < filmmakers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    totalSent,
    failed,
    details: results,
  };
}

/**
 * Get paginated list of filmmakers
 */
export async function getFilmmakers(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<{
  filmmakers: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  let query = db.select().from(filmmakerContacts);

  // Apply search filter if provided
  if (search) {
    const searchLower = search.toLowerCase();
    query = query.where(() => {
      // Search in multiple fields
      return filmmakerContacts.name.toLowerCase().includes(searchLower) ||
             filmmakerContacts.email.toLowerCase().includes(searchLower) ||
             filmmakerContacts.filmTitle?.toLowerCase().includes(searchLower);
    });
  }

  // Get total count
  const countResult = await query.count();
  const total = countResult[0].count as number;

  // Get paginated results
  const offset = (page - 1) * limit;
  const filmmakers = await query
    .limit(limit)
    .offset(offset)
    .orderBy(filmmakerContacts.dateAdded.desc());

  return {
    filmmakers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
