
dbSchemaExporter.js
// ============================================================================
// dbSchemaExporter.js - 현재 모든 DB 구조를 출력 및 저장
// ============================================================================
// 기능:
// 1. 모든 테이블 조회
// 2. 각 테이블의 컬럼 정보 조회
// 3. 각 테이블의 인덱스 조회
// 4. 각 테이블의 FK 제약 조회
// 5. 모든 정보를 파일로 저장

const fs = require('fs');
const path = require('path');
const { executeQuery } = require('./config/database');

/**
 * DB 스키마 정보를 조회하고 저장하는 클래스
 */
class DBSchemaExporter {
    constructor(outputDir = './db-schema-exports') {
        this.outputDir = outputDir;
        this.schemaData = {};
        
        // 출력 디렉토리 생성
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * 모든 테이블 이름 조회
     */
    async getAllTables() {
        try {
            const query = `
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                AND TABLE_CATALOG = DB_NAME()
                ORDER BY TABLE_NAME
            `;
            
            const tables = await executeQuery(query);
            return tables.map(t => t.TABLE_NAME);
        } catch (err) {
            console.error('테이블 조회 실패:', err);
            throw err;
        }
    }

    /**
     * 특정 테이블의 컬럼 정보 조회
     */
    async getTableColumns(tableName) {
        try {
            const query = `
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE,
                    IS_NULLABLE,
                    COLUMN_DEFAULT,
                    ORDINAL_POSITION
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = @tableName
                ORDER BY ORDINAL_POSITION
            `;
            
            const columns = await executeQuery(query, { tableName });
            return columns;
        } catch (err) {
            console.error(`${tableName} 컬럼 조회 실패:`, err);
            throw err;
        }
    }

    /**
     * 특정 테이블의 인덱스 정보 조회
     */
    async getTableIndexes(tableName) {
        try {
            const query = `
                SELECT 
                    i.name as INDEX_NAME,
                    ic.column_id,
                    COL_NAME(ic.object_id, ic.column_id) as COLUMN_NAME,
                    i.type_desc as INDEX_TYPE,
                    i.is_unique,
                    i.is_primary_key
                FROM sys.indexes i
                INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id 
                    AND i.index_id = ic.index_id
                INNER JOIN sys.tables t ON i.object_id = t.object_id
                WHERE t.name = @tableName
                ORDER BY i.index_id, ic.key_ordinal
            `;
            
            const indexes = await executeQuery(query, { tableName });
            return indexes;
        } catch (err) {
            console.error(`${tableName} 인덱스 조회 실패:`, err);
            return [];
        }
    }

    /**
     * 특정 테이블의 FK 제약 정보 조회
     */
    async getTableForeignKeys(tableName) {
        try {
            const query = `
                SELECT 
                    CONSTRAINT_NAME,
                    TABLE_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = @tableName 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `;
            
            const fks = await executeQuery(query, { tableName });
            return fks;
        } catch (err) {
            console.error(`${tableName} FK 조회 실패:`, err);
            return [];
        }
    }

    /**
     * 특정 테이블의 PK 정보 조회
     */
    async getTablePrimaryKey(tableName) {
        try {
            const query = `
                SELECT 
                    CONSTRAINT_NAME,
                    COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = @tableName 
                AND CONSTRAINT_NAME LIKE 'PK_%'
            `;
            
            const pk = await executeQuery(query, { tableName });
            return pk;
        } catch (err) {
            console.error(`${tableName} PK 조회 실패:`, err);
            return [];
        }
    }

    /**
     * 특정 테이블의 모든 정보 조회
     */
    async getTableSchema(tableName) {
        try {
            console.log(`📋 ${tableName} 스키마 조회 중...`);
            
            const [columns, indexes, foreignKeys, primaryKey] = await Promise.all([
                this.getTableColumns(tableName),
                this.getTableIndexes(tableName),
                this.getTableForeignKeys(tableName),
                this.getTablePrimaryKey(tableName)
            ]);
            
            return {
                tableName,
                columns,
                indexes,
                foreignKeys,
                primaryKey,
                rowCount: await this.getTableRowCount(tableName)
            };
        } catch (err) {
            console.error(`${tableName} 스키마 조회 실패:`, err);
            throw err;
        }
    }

    /**
     * 특정 테이블의 행 개수 조회
     */
    async getTableRowCount(tableName) {
        try {
            const query = `SELECT COUNT(*) as count FROM [${tableName}]`;
            const result = await executeQuery(query);
            return result[0]?.count || 0;
        } catch (err) {
            console.error(`${tableName} 행 개수 조회 실패:`, err);
            return 0;
        }
    }

    /**
     * 모든 테이블 스키마 조회 및 저장
     */
    async exportAllSchemas() {
        try {
            console.log('\n🔍 DB 스키마 조회 시작...\n');
            
            const tables = await this.getAllTables();
            console.log(`📊 발견된 테이블: ${tables.length}개\n`);
            
            this.schemaData = {
                exportDate: new Date().toISOString(),
                database: 'booster_db',
                tableCount: tables.length,
                tables: {}
            };
            
            // 각 테이블 스키마 조회
            for (const tableName of tables) {
                const schema = await this.getTableSchema(tableName);
                this.schemaData.tables[tableName] = schema;
            }
            
            console.log('✅ 모든 스키마 조회 완료\n');
            return this.schemaData;
        } catch (err) {
            console.error('❌ 스키마 조회 실패:', err);
            throw err;
        }
    }

    /**
     * JSON 형식으로 저장
     */
    async saveAsJSON() {
        try {
            const filename = `db-schema-${new Date().getTime()}.json`;
            const filepath = path.join(this.outputDir, filename);
            
            fs.writeFileSync(
                filepath, 
                JSON.stringify(this.schemaData, null, 2),
                'utf8'
            );
            
            console.log(`✅ JSON 저장 완료: ${filepath}\n`);
            return filepath;
        } catch (err) {
            console.error('❌ JSON 저장 실패:', err);
            throw err;
        }
    }

    /**
     * Markdown 형식으로 저장
     */
    async saveAsMarkdown() {
        try {
            let markdown = '# 📊 데이터베이스 스키마 문서\n\n';
            markdown += `**내보내기 날짜**: ${new Date().toLocaleString('ko-KR')}\n`;
            markdown += `**데이터베이스**: ${this.schemaData.database}\n`;
            markdown += `**테이블 수**: ${this.schemaData.tableCount}\n\n`;
            
            markdown += '---\n\n';
            markdown += '## 📋 테이블 목차\n\n';
            
            // 테이블 목차
            Object.keys(this.schemaData.tables).forEach(tableName => {
                markdown += `- [${tableName}](#${tableName.toLowerCase()})\n`;
            });
            
            markdown += '\n---\n\n';
            
            // 각 테이블 상세 정보
            for (const [tableName, schema] of Object.entries(this.schemaData.tables)) {
                markdown += this.generateTableMarkdown(tableName, schema);
            }
            
            const filename = `db-schema-${new Date().getTime()}.md`;
            const filepath = path.join(this.outputDir, filename);
            
            fs.writeFileSync(filepath, markdown, 'utf8');
            
            console.log(`✅ Markdown 저장 완료: ${filepath}\n`);
            return filepath;
        } catch (err) {
            console.error('❌ Markdown 저장 실패:', err);
            throw err;
        }
    }

    /**
     * Markdown 테이블 정보 생성
     */
    generateTableMarkdown(tableName, schema) {
        let md = `## ${tableName}\n\n`;
        md += `**행 개수**: ${schema.rowCount}\n\n`;
        
        // 컬럼 정보
        md += '### 컬럼\n\n';
        md += '| # | 컬럼명 | 데이터타입 | 크기 | NULL 허용 | 기본값 |\n';
        md += '|---|--------|-----------|------|----------|-------|\n';
        
        schema.columns.forEach((col, idx) => {
            const size = col.CHARACTER_MAXIMUM_LENGTH || 
                        (col.NUMERIC_PRECISION ? `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})` : '-');
            const nullable = col.IS_NULLABLE === 'YES' ? '✓' : '✗';
            const defaultVal = col.COLUMN_DEFAULT ? `\`${col.COLUMN_DEFAULT}\`` : '-';
            
            md += `| ${idx + 1} | ${col.COLUMN_NAME} | ${col.DATA_TYPE} | ${size} | ${nullable} | ${defaultVal} |\n`;
        });
        
        md += '\n';
        
        // PK 정보
        if (schema.primaryKey.length > 0) {
            md += '### 기본키 (Primary Key)\n\n';
            schema.primaryKey.forEach(pk => {
                md += `- **${pk.CONSTRAINT_NAME}**: ${pk.COLUMN_NAME}\n`;
            });
            md += '\n';
        }
        
        // 인덱스 정보
        if (schema.indexes.length > 0) {
            md += '### 인덱스\n\n';
            const indexMap = {};
            schema.indexes.forEach(idx => {
                if (!indexMap[idx.INDEX_NAME]) {
                    indexMap[idx.INDEX_NAME] = {
                        columns: [],
                        type: idx.INDEX_TYPE,
                        isPrimary: idx.is_primary_key,
                        isUnique: idx.is_unique
                    };
                }
                indexMap[idx.INDEX_NAME].columns.push(idx.COLUMN_NAME);
            });
            
            Object.entries(indexMap).forEach(([name, info]) => {
                const type = info.isPrimary ? 'PRIMARY' : (info.isUnique ? 'UNIQUE' : 'NON-UNIQUE');
                md += `- **${name}** (${type}): ${info.columns.join(', ')}\n`;
            });
            md += '\n';
        }
        
        // FK 정보
        if (schema.foreignKeys.length > 0) {
            md += '### 외부키 (Foreign Key)\n\n';
            schema.foreignKeys.forEach(fk => {
                md += `- **${fk.CONSTRAINT_NAME}**: ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})\n`;
            });
            md += '\n';
        }
        
        md += '---\n\n';
        return md;
    }

    /**
     * SQL 생성 스크립트 저장
     */
    async saveSQLCreateScript() {
        try {
            let sql = '-- ============================================================================\n';
            sql += '-- DB 스키마 생성 스크립트\n';
            sql += '-- 생성일시: ' + new Date().toLocaleString('ko-KR') + '\n';
            sql += '-- ============================================================================\n\n';
            
            sql += 'USE [booster_db];\nGO\n\n';
            
            // 각 테이블의 CREATE 문 조회
            for (const tableName of Object.keys(this.schemaData.tables)) {
                const createScript = await this.getTableCreateScript(tableName);
                sql += createScript + '\n\nGO\n\n';
            }
            
            const filename = `db-schema-create-${new Date().getTime()}.sql`;
            const filepath = path.join(this.outputDir, filename);
            
            fs.writeFileSync(filepath, sql, 'utf8');
            
            console.log(`✅ SQL 스크립트 저장 완료: ${filepath}\n`);
            return filepath;
        } catch (err) {
            console.error('❌ SQL 스크립트 저장 실패:', err);
            throw err;
        }
    }

    /**
     * 특정 테이블의 CREATE 문 조회
     */
    async getTableCreateScript(tableName) {
        try {
            const query = `
                SELECT OBJECT_DEFINITION(OBJECT_ID('${tableName}'))
            `;
            
            const result = await executeQuery(query);
            return result[0] ? Object.values(result[0])[0] : `-- ${tableName} CREATE 문 조회 실패`;
        } catch (err) {
            console.error(`${tableName} CREATE 문 조회 실패:`, err);
            return `-- ${tableName} CREATE 문 조회 실패`;
        }
    }

    /**
     * 전체 내보내기 (JSON, Markdown, SQL)
     */
    async exportAll() {
        try {
            // 1. 스키마 조회
            await this.exportAllSchemas();
            
            // 2. 모든 형식으로 저장
            const results = await Promise.all([
                this.saveAsJSON(),
                this.saveAsMarkdown(),
                this.saveSQLCreateScript()
            ]);
            
            console.log('🎉 모든 내보내기 완료!\n');
            console.log('📁 저장된 파일:');
            results.forEach((filepath, idx) => {
                console.log(`   ${idx + 1}. ${filepath}`);
            });
            
            return results;
        } catch (err) {
            console.error('❌ 내보내기 실패:', err);
            throw err;
        }
    }

    /**
     * 콘솔에 스키마 출력
     */
    printSchema() {
        try {
            console.log('\n');
            console.log('╔════════════════════════════════════════════════════════════════════╗');
            console.log('║              📊 데이터베이스 스키마 정보                           ║');
            console.log('╚════════════════════════════════════════════════════════════════════╝');
            console.log('\n');
            
            console.log(`📅 내보내기 날짜: ${new Date().toLocaleString('ko-KR')}`);
            console.log(`🗄️  데이터베이스: ${this.schemaData.database}`);
            console.log(`📋 총 테이블 수: ${this.schemaData.tableCount}\n`);
            
            // 각 테이블 정보 출력
            for (const [tableName, schema] of Object.entries(this.schemaData.tables)) {
                console.log(`\n${'─'.repeat(70)}`);
                console.log(`📌 테이블: ${tableName}`);
                console.log(`📊 행 개수: ${schema.rowCount}`);
                console.log(`${'─'.repeat(70)}`);
                
                // 컬럼 정보
                console.log('\n   🔹 컬럼:');
                schema.columns.forEach((col, idx) => {
                    const size = col.CHARACTER_MAXIMUM_LENGTH || 
                                (col.NUMERIC_PRECISION ? `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})` : '');
                    const nullable = col.IS_NULLABLE === 'YES' ? 'NULL OK' : 'NOT NULL';
                    const pk = schema.primaryKey.some(p => p.COLUMN_NAME === col.COLUMN_NAME) ? ' [PK]' : '';
                    
                    console.log(`      ${idx + 1}. ${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE.padEnd(12)} ${size.padEnd(8)} ${nullable}${pk}`);
                });
                
                // PK 정보
                if (schema.primaryKey.length > 0) {
                    console.log('\n   🔹 기본키:');
                    schema.primaryKey.forEach(pk => {
                        console.log(`      - ${pk.COLUMN_NAME}`);
                    });
                }
                
                // FK 정보
                if (schema.foreignKeys.length > 0) {
                    console.log('\n   🔹 외부키:');
                    schema.foreignKeys.forEach(fk => {
                        console.log(`      - ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})`);
                    });
                }
                
                // 인덱스 정보
                if (schema.indexes.length > 0) {
                    console.log('\n   🔹 인덱스:');
                    const indexMap = {};
                    schema.indexes.forEach(idx => {
                        if (!indexMap[idx.INDEX_NAME]) {
                            indexMap[idx.INDEX_NAME] = [];
                        }
                        indexMap[idx.INDEX_NAME].push(idx.COLUMN_NAME);
                    });
                    
                    Object.entries(indexMap).forEach(([name, cols]) => {
                        console.log(`      - ${name}: ${cols.join(', ')}`);
                    });
                }
            }
            
            console.log('\n');
            console.log('╚════════════════════════════════════════════════════════════════════╝');
            console.log('\n');
        } catch (err) {
            console.error('❌ 스키마 출력 실패:', err);
        }
    }
}

// ============================================================================
// 사용 예시
// ============================================================================

async function main() {
    try {
        const exporter = new DBSchemaExporter('./db-schema-exports');
        
        // 1. 모든 스키마 조회 및 저장
        await exporter.exportAll();
        
        // 2. 콘솔에 출력
        exporter.printSchema();
        
    } catch (err) {
        console.error('❌ 실행 실패:', err);
        process.exit(1);
    }
}

// 명령줄에서 직접 실행 가능
if (require.main === module) {
    main();
}

module.exports = DBSchemaExporter;

// ============================================================================
// 사용 방법
// ============================================================================
/*
1. 직접 실행:
   node dbSchemaExporter.js

2. 다른 파일에서 임포트:
   const DBSchemaExporter = require('./dbSchemaExporter');
   const exporter = new DBSchemaExporter();
   await exporter.exportAll();

3. 특정 기능만 사용:
   const exporter = new DBSchemaExporter();
   await exporter.exportAllSchemas();
   await exporter.saveAsJSON();
   await exporter.saveAsMarkdown();
   exporter.printSchema();
*/