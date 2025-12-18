
const mssql = require('mssql');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 1. 설정
// ============================================================================

const sqlConfig = {
    server: process.env.DB_SERVER || 'booster-sqlserver.database.windows.net',
    database: process.env.DB_DATABASE || 'booster_db',
    user: process.env.DB_USER || 'booster_admin',
    password: 'tgw2025*',
    encrypt: process.env.DB_ENCRYPTION === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true' || true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
        min: 1,
        max: 5,
        idleTimeoutMillis: 30000
    }
};

// ============================================================================
// 2. 데이터베이스 구조 추출 클래스 (수정)
// ============================================================================

class DatabaseSchemaExporter {
    constructor(config) {
        this.config = config;
        this.pool = null;
        this.schema = {
            database: config.database,
            exportedAt: new Date().toISOString(),
            tables: [],
            views: [],
            storedProcedures: [],
            triggers: [],
            indexes: [],
            foreignKeys: [],
            constraints: []
        };
    }

    /**
     * DB 연결
     */
    async connect() {
        try {
            this.pool = new mssql.ConnectionPool(this.config);
            await this.pool.connect();
            console.log('✅ 데이터베이스 연결 성공');
        } catch (err) {
            console.error('❌ 데이터베이스 연결 실패:', err.message);
            throw err;
        }
    }

    /**
     * DB 연결 종료
     */
    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.close();
                console.log('✅ 데이터베이스 연결 종료');
            }
        } catch (err) {
            console.error('❌ 연결 종료 실패:', err.message);
        }
    }

    /**
     * 모든 테이블 정보 추출 (수정: schema 키워드 문제)
     */
    async extractTables() {
        try {
            console.log('⏳ 테이블 정보 추출 중...');

            // ✅ 수정: TABLE_SCHEMA를 별칭으로 사용
            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        TABLE_NAME as name,
                        TABLE_SCHEMA as [schema]
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE'
                    ORDER BY TABLE_NAME
                `);

            for (const table of result.recordset) {
                const columns = await this.extractColumns(table.name);
                const pk = await this.extractPrimaryKey(table.name);

                this.schema.tables.push({
                    name: table.name,
                    schema: table.schema,
                    columns: columns,
                    primaryKey: pk
                });
            }

            console.log(`✅ ${this.schema.tables.length}개 테이블 추출 완료`);
        } catch (err) {
            console.error('❌ 테이블 추출 실패:', err.message);
        }
    }

    /**
     * 특정 테이블의 컬럼 정보 추출
     */
    async extractColumns(tableName) {
        try {
            // ✅ 수정: CHARACTER_MAXIMUM_LENGTH 제거 (모든 데이터 타입에서 지원하지 않음)
            const result = await this.pool
                .request()
                .input('tableName', mssql.NVarChar, tableName)
                .query(`
                    SELECT 
                        COLUMN_NAME as name,
                        DATA_TYPE as dataType,
                        CHARACTER_MAXIMUM_LENGTH as maxLength,
                        IS_NULLABLE as isNullable,
                        COLUMN_DEFAULT as defaultValue,
                        ORDINAL_POSITION as position,
                        NUMERIC_PRECISION as precision,
                        NUMERIC_SCALE as scale
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = @tableName
                    ORDER BY ORDINAL_POSITION
                `);

            return result.recordset.map(col => ({
                name: col.name,
                dataType: col.dataType,
                maxLength: col.maxLength,
                precision: col.precision,
                scale: col.scale,
                isNullable: col.isNullable === 'YES',
                defaultValue: col.defaultValue,
                position: col.position
            }));
        } catch (err) {
            console.error(`❌ 컬럼 추출 실패 (${tableName}):`, err.message);
            return [];
        }
    }

    /**
     * Primary Key 추출
     */
    async extractPrimaryKey(tableName) {
        try {
            const result = await this.pool
                .request()
                .input('tableName', mssql.NVarChar, tableName)
                .query(`
                    SELECT 
                        CONSTRAINT_NAME as name,
                        COLUMN_NAME as column
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_NAME = @tableName 
                    AND CONSTRAINT_NAME LIKE 'PK_%'
                `);

            if (result.recordset.length === 0) return null;

            return {
                name: result.recordset[0].name,
                columns: result.recordset.map(r => r.column)
            };
        } catch (err) {
            console.error(`❌ PK 추출 실패 (${tableName}):`, err.message);
            return null;
        }
    }

    /**
     * 모든 뷰 정보 추출 (수정: schema 키워드 문제)
     */
    async extractViews() {
        try {
            console.log('⏳ 뷰 정보 추출 중...');

            // ✅ 수정: TABLE_SCHEMA를 별칭으로 사용
            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        TABLE_NAME as name,
                        TABLE_SCHEMA as [schema]
                    FROM INFORMATION_SCHEMA.VIEWS
                    WHERE TABLE_SCHEMA = 'dbo'
                    ORDER BY TABLE_NAME
                `);

            for (const view of result.recordset) {
                const columns = await this.extractColumns(view.name);

                this.schema.views.push({
                    name: view.name,
                    schema: view.schema,
                    columns: columns
                });
            }

            console.log(`✅ ${this.schema.views.length}개 뷰 추출 완료`);
        } catch (err) {
            console.error('❌ 뷰 추출 실패:', err.message);
        }
    }

    /**
     * 모든 저장 프로시저 추출 (수정: schema 키워드 문제)
     */
    async extractStoredProcedures() {
        try {
            console.log('⏳ 저장 프로시저 정보 추출 중...');

            // ✅ 수정: ROUTINE_SCHEMA를 별칭으로 사용
            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        ROUTINE_NAME as name,
                        ROUTINE_SCHEMA as [schema],
                        ROUTINE_DEFINITION as definition
                    FROM INFORMATION_SCHEMA.ROUTINES
                    WHERE ROUTINE_TYPE = 'PROCEDURE'
                    AND ROUTINE_SCHEMA = 'dbo'
                    ORDER BY ROUTINE_NAME
                `);

            for (const proc of result.recordset) {
                const params = await this.extractProcedureParameters(proc.name);

                this.schema.storedProcedures.push({
                    name: proc.name,
                    schema: proc.schema,
                    parameters: params,
                    definition: proc.definition
                });
            }

            console.log(`✅ ${this.schema.storedProcedures.length}개 저장 프로시저 추출 완료`);
        } catch (err) {
            console.error('❌ 저장 프로시저 추출 실패:', err.message);
        }
    }

    /**
     * 저장 프로시저 파라미터 추출
     */
    async extractProcedureParameters(procName) {
        try {
            const result = await this.pool
                .request()
                .input('procName', mssql.NVarChar, procName)
                .query(`
                    SELECT 
                        PARAMETER_NAME as name,
                        DATA_TYPE as dataType,
                        CHARACTER_MAXIMUM_LENGTH as maxLength,
                        PARAMETER_MODE as mode
                    FROM INFORMATION_SCHEMA.PARAMETERS
                    WHERE SPECIFIC_NAME = @procName
                    ORDER BY ORDINAL_POSITION
                `);

            return result.recordset.map(param => ({
                name: param.name,
                dataType: param.dataType,
                maxLength: param.maxLength,
                mode: param.mode
            }));
        } catch (err) {
            return [];
        }
    }

    /**
     * 모든 트리거 추출
     */
    async extractTriggers() {
        try {
            console.log('⏳ 트리거 정보 추출 중...');

            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        name,
                        OBJECT_NAME(parent_id) as table_name,
                        type_desc as trigger_type
                    FROM sys.triggers
                    WHERE is_ms_shipped = 0
                    ORDER BY name
                `);

            this.schema.triggers = result.recordset.map(trig => ({
                name: trig.name,
                tableName: trig.table_name,
                type: trig.trigger_type
            }));

            console.log(`✅ ${this.schema.triggers.length}개 트리거 추출 완료`);
        } catch (err) {
            console.error('❌ 트리거 추출 실패:', err.message);
        }
    }

    /**
     * 모든 인덱스 추출
     */
    async extractIndexes() {
        try {
            console.log('⏳ 인덱스 정보 추출 중...');

            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        t.name as table_name,
                        i.name as index_name,
                        i.type_desc as index_type,
                        c.name as column_name
                    FROM sys.indexes i
                    INNER JOIN sys.tables t ON i.object_id = t.object_id
                    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id 
                        AND i.index_id = ic.index_id
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id 
                        AND ic.column_id = c.column_id
                    WHERE i.name IS NOT NULL
                    AND t.name NOT IN ('sysdiagrams')
                    ORDER BY t.name, i.name
                `);

            // 인덱스 그룹화
            const indexMap = {};
            for (const idx of result.recordset) {
                const key = `${idx.table_name}.${idx.index_name}`;
                if (!indexMap[key]) {
                    indexMap[key] = {
                        tableName: idx.table_name,
                        name: idx.index_name,
                        type: idx.index_type,
                        columns: []
                    };
                }
                indexMap[key].columns.push(idx.column_name);
            }

            this.schema.indexes = Object.values(indexMap);
            console.log(`✅ ${this.schema.indexes.length}개 인덱스 추출 완료`);
        } catch (err) {
            console.error('❌ 인덱스 추출 실패:', err.message);
        }
    }

    /**
     * 모든 Foreign Key 추출
     */
    async extractForeignKeys() {
        try {
            console.log('⏳ Foreign Key 정보 추출 중...');

            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        RC.CONSTRAINT_NAME as fk_name,
                        KCU1.TABLE_NAME as table_name,
                        KCU1.COLUMN_NAME as column_name,
                        KCU2.TABLE_NAME as referenced_table,
                        KCU2.COLUMN_NAME as referenced_column,
                        RC.DELETE_RULE as on_delete,
                        RC.UPDATE_RULE as on_update
                    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
                    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU1 
                        ON RC.CONSTRAINT_NAME = KCU1.CONSTRAINT_NAME
                    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU2 
                        ON RC.UNIQUE_CONSTRAINT_NAME = KCU2.CONSTRAINT_NAME
                    ORDER BY KCU1.TABLE_NAME
                `);

            this.schema.foreignKeys = result.recordset.map(fk => ({
                name: fk.fk_name,
                tableName: fk.table_name,
                columnName: fk.column_name,
                referencedTable: fk.referenced_table,
                referencedColumn: fk.referenced_column,
                onDelete: fk.on_delete,
                onUpdate: fk.on_update
            }));

            console.log(`✅ ${this.schema.foreignKeys.length}개 Foreign Key 추출 완료`);
        } catch (err) {
            console.error('❌ Foreign Key 추출 실패:', err.message);
        }
    }

    /**
     * 모든 제약 조건(Constraints) 추출 (수정: CHECK_CLAUSE 제거)
     */
    async extractConstraints() {
        try {
            console.log('⏳ 제약 조건 정보 추출 중...');

            // ✅ 수정: CHECK_CLAUSE 제거 (모든 버전에서 지원하지 않음)
            // sys.check_constraints를 대신 사용
            const result = await this.pool
                .request()
                .query(`
                    SELECT 
                        CONSTRAINT_NAME as name,
                        TABLE_NAME as table_name,
                        'PRIMARY KEY' as type
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_TYPE = 'PRIMARY KEY'
                    
                    UNION ALL
                    
                    SELECT 
                        CONSTRAINT_NAME as name,
                        TABLE_NAME as table_name,
                        'UNIQUE' as type
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_TYPE = 'UNIQUE'
                    
                    UNION ALL
                    
                    SELECT 
                        cc.name as name,
                        OBJECT_NAME(cc.parent_object_id) as table_name,
                        'CHECK' as type
                    FROM sys.check_constraints cc
                    
                    ORDER BY table_name
                `);

            this.schema.constraints = result.recordset.map(con => ({
                name: con.name,
                tableName: con.table_name,
                type: con.type
            }));

            console.log(`✅ ${this.schema.constraints.length}개 제약 조건 추출 완료`);
        } catch (err) {
            console.error('❌ 제약 조건 추출 실패:', err.message);
        }
    }

    /**
     * 전체 스키마 추출
     */
    async exportSchema() {
        try {
            await this.connect();

            console.log('\n📋 데이터베이스 구조 추출 시작...\n');

            await this.extractTables();
            await this.extractViews();
            await this.extractStoredProcedures();
            await this.extractTriggers();
            await this.extractIndexes();
            await this.extractForeignKeys();
            await this.extractConstraints();

            console.log('\n✅ 모든 구조 추출 완료!\n');

            return this.schema;
        } catch (err) {
            console.error('\n❌ 스키마 추출 실패:', err.message);
            throw err;
        } finally {
            await this.disconnect();
        }
    }

    /**
     * JSON 파일로 저장
     */
    async saveToJson(outputPath) {
        try {
            const schema = await this.exportSchema();

            // 파일 경로 생성
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // JSON 파일 저장
            fs.writeFileSync(
                outputPath,
                JSON.stringify(schema, null, 2),
                'utf8'
            );

            console.log(`📁 JSON 파일 저장 완료: ${outputPath}`);
            console.log(`📊 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

            return schema;
        } catch (err) {
            console.error('❌ JSON 저장 실패:', err.message);
            throw err;
        }
    }

    /**
     * 콘솔에 출력
     */
    printSchema() {
        console.log('\n' + JSON.stringify(this.schema, null, 2));
    }
}

// ============================================================================
// 3. 실행
// ============================================================================

async function main() {
    const exporter = new DatabaseSchemaExporter(sqlConfig);

    try {
        // 출력 경로
        const outputPath = path.join(__dirname, 'db-schema.json');

        // JSON으로 저장
        const schema = await exporter.saveToJson(outputPath);

        // 요약 정보 출력
        console.log('\n' + '='.repeat(60));
        console.log('📊 데이터베이스 구조 요약');
        console.log('='.repeat(60));
        console.log(`📦 데이터베이스: ${schema.database}`);
        console.log(`📅 추출 시간: ${schema.exportedAt}`);
        console.log(`📋 테이블: ${schema.tables.length}개`);
        console.log(`👁️  뷰: ${schema.views.length}개`);
        console.log(`⚙️  저장 프로시저: ${schema.storedProcedures.length}개`);
        console.log(`🔥 트리거: ${schema.triggers.length}개`);
        console.log(`🔍 인덱스: ${schema.indexes.length}개`);
        console.log(`🔗 Foreign Key: ${schema.foreignKeys.length}개`);
        console.log(`📌 제약 조건: ${schema.constraints.length}개`);
        console.log('='.repeat(60) + '\n');

        // 테이블 목록 출력
        if (schema.tables.length > 0) {
            console.log('📋 테이블 목록:');
            schema.tables.forEach((table, idx) => {
                console.log(`  ${idx + 1}. ${table.name} (${table.columns.length} 컬럼)`);
            });
        }

    } catch (err) {
        console.error('❌ 실행 실패:', err.message);
        process.exit(1);
    }
}

// 실행
main();