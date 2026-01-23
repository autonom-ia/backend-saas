/**
 * Migration: Add subdomain field to product table
 * 
 * This adds a subdomain field to products, allowing validation by subdomain.domain
 * where domain comes from the associated company.
 * The subdomain must be unique within a company (composite unique constraint).
 */
exports.up = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    // Add subdomain field (nullable for existing products)
    table.string('subdomain', 255).nullable();
    
    // Create index for efficient subdomain lookups
    table.index('subdomain', 'product_subdomain_idx');
    
    // Create unique constraint for (company_id, subdomain) combination
    // This ensures subdomain uniqueness within a company
    table.unique(['company_id', 'subdomain'], 'product_company_subdomain_unique_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    // Drop unique constraint first (using columns, Knex will find it)
    table.dropUnique(['company_id', 'subdomain']);
    
    // Drop index
    table.dropIndex('subdomain', 'product_subdomain_idx');
    
    // Drop column
    table.dropColumn('subdomain');
  });
};
