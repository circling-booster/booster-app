// ============================================================================
// Database Schema Utilities
// JSON 스키마를 다루기 위한 유틸리티 함수
// ============================================================================

const fs = require('fs');
const path = require('path');

// ============================================================================
// 1. 스키마 검증 클래스
// ============================================================================

class SchemaValidator {
    constructor(schemaPath) {
        this.schemaPath = schemaPath;
        this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        this.issues = [];
    }

    /**
     * 전체 스키마 검증
     */
    validate() {
        console.log('🔍 스키마 검증 시작...\n');

        this.validateTables();
        this.validateForeignKeys();
        this.validateIndexes();
        this.validateConstraints();

        this.printResults();
        return this.issues;
    }

    /**
     * 테이블 검증
     */
    validateTables() {
        console.log('📋 테이블 검증 중...');

        this.schema.tables.forEach(table => {
            // 컬럼 확인
            if (!table.columns || table.columns.length === 0) {
                this.issues.push(`⚠️  테이블 '${table.name}'에 컬럼이 없습니다.`);
            }

            // 중복 컬럼명 확인
            const columnNames = table.columns.map(c => c.name);
            const duplicates = columnNames.filter((item, index) => columnNames.indexOf(item) !== index);
            if (duplicates.length > 0) {
                this.issues.push(`⚠️  테이블 '${table.name}'에 중복 컬럼: ${duplicates.join(', ')}`);
            }

            // Primary Key 확인
            if (!table.primaryKey) {
                this.issues.push(`⚠️  테이블 '${table.name}'에 Primary Key가 없습니다.`);
            }
        });

        console.log(`✅ 테이블 검증 완료: ${this.schema.tables.length}개 테이블 확인\n`);
    }

    /**
     * Foreign Key 검증
     */
    validateForeignKeys() {
        console.log('🔗 Foreign Key 검증 중...');

        this.schema.foreignKeys.forEach(fk => {
            // 참조 테이블 확인
            const sourceTable = this.schema.tables.find(t => t.name === fk.tableName);
            if (!sourceTable) {
                this.issues.push(`❌ FK '${fk.name}': 테이블 '${fk.tableName}'을 찾을 수 없습니다.`);
                return;
            }

            // 참조 컬럼 확인
            const sourceColumn = sourceTable.columns.find(c => c.name === fk.columnName);
            if (!sourceColumn) {
                this.issues.push(`❌ FK '${fk.name}': 컬럼 '${fk.tableName}.${fk.columnName}'을 찾을 수 없습니다.`);
            }

            // 대상 테이블 확인
            const targetTable = this.schema.tables.find(t => t.name === fk.referencedTable);
            if (!targetTable) {
                this.issues.push(`❌ FK '${fk.name}': 대상 테이블 '${fk.referencedTable}'을 찾을 수 없습니다.`);
                return;
            }

            // 대상 컬럼 확인
            const targetColumn = targetTable.columns.find(c => c.name === fk.referencedColumn);
            if (!targetColumn) {
                this.issues.push(`❌ FK '${fk.name}': 대상 컬럼 '${fk.referencedTable}.${fk.referencedColumn}'을 찾을 수 없습니다.`);
            }

            // 데이터 타입 일치 확인
            if (sourceColumn && targetColumn && sourceColumn.dataType !== targetColumn.dataType) {
                this.issues.push(`⚠️  FK '${fk.name}': 데이터 타입 불일치 (${sourceColumn.dataType} ≠ ${targetColumn.dataType})`);
            }
        });

        console.log(`✅ Foreign Key 검증 완료: ${this.schema.foreignKeys.length}개 FK 확인\n`);
    }

    /**
     * 인덱스 검증
     */
    validateIndexes() {
        console.log('🔍 인덱스 검증 중...');

        this.schema.indexes.forEach(idx => {
            const table = this.schema.tables.find(t => t.name === idx.tableName);
            if (!table) {
                this.issues.push(`❌ 인덱스 '${idx.name}': 테이블 '${idx.tableName}'을 찾을 수 없습니다.`);
                return;
            }

            // 모든 컬럼 확인
            idx.columns.forEach(colName => {
                const column = table.columns.find(c => c.name === colName);
                if (!column) {
                    this.issues.push(`❌ 인덱스 '${idx.name}': 컬럼 '${idx.tableName}.${colName}'을 찾을 수 없습니다.`);
                }
            });
        });

        console.log(`✅ 인덱스 검증 완료: ${this.schema.indexes.length}개 인덱스 확인\n`);
    }

    /**
     * 제약 조건 검증
     */
    validateConstraints() {
        console.log('📌 제약 조건 검증 중...');

        this.schema.constraints.forEach(constraint => {
            const table = this.schema.tables.find(t => t.name === constraint.tableName);
            if (!table) {
                this.issues.push(`❌ 제약 '${constraint.name}': 테이블 '${constraint.tableName}'을 찾을 수 없습니다.`);
            }
        });

        console.log(`✅ 제약 조건 검증 완료: ${this.schema.constraints.length}개 제약 확인\n`);
    }

    /**
     * 결과 출력
     */
    printResults() {
        console.log('=' .repeat(70));
        console.log('📊 검증 결과');
        console.log('=' .repeat(70));

        if (this.issues.length === 0) {
            console.log('✅ 모든 항목이 정상입니다!\n');
        } else {
            console.log(`⚠️  ${this.issues.length}개의 문제를 발견했습니다:\n`);
            this.issues.forEach((issue, idx) => {
                console.log(`  ${idx + 1}. ${issue}`);
            });
            console.log();
        }

        console.log('=' .repeat(70));
    }
}

// ============================================================================
// 2. 스키마 분석 클래스
// ============================================================================

class SchemaAnalyzer {
    constructor(schemaPath) {
        this.schemaPath = schemaPath;
        this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    }

    /**
     * 전체 분석
     */
    analyze() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 데이터베이스 분석');
        console.log('='.repeat(70) + '\n');

        this.analyzeTablesMetrics();
        this.analyzeDataTypes();
        this.analyzeNullability();
        this.analyzeRelationships();
        this.analyzeIndexCoverage();

        return {
            metrics: this.getMetrics(),
            warnings: this.getWarnings()
        };
    }

    /**
     * 테이블 메트릭 분석
     */
    analyzeTablesMetrics() {
        console.log('📋 테이블 메트릭\n');

        const metrics = this.schema.tables.map(t => ({
            name: t.name,
            columns: t.columns.length,
            hasPK: !!t.primaryKey
        }));

        // 크기순 정렬
        metrics.sort((a, b) => b.columns - a.columns);

        metrics.forEach(m => {
            const pk = m.hasPK ? '✅' : '❌';
            console.log(`  ${pk} ${m.name}: ${m.columns} 컬럼`);
        });

        console.log();
    }

    /**
     * 데이터 타입 분석
     */
    analyzeDataTypes() {
        console.log('🔤 데이터 타입 분포\n');

        const distribution = {};
        this.schema.tables.forEach(table => {
            table.columns.forEach(col => {
                distribution[col.dataType] = (distribution[col.dataType] || 0) + 1;
            });
        });

        // 빈도순 정렬
        Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                const percentage = ((count / this.getTotalColumns()) * 100).toFixed(1);
                console.log(`  ${type.padEnd(20)} : ${String(count).padStart(3)} (${percentage}%)`);
            });

        console.log();
    }

    /**
     * NULL 허용도 분석
     */
    analyzeNullability() {
        console.log('✅ NULL 허용도\n');

        let nullableCount = 0;
        let notNullCount = 0;

        this.schema.tables.forEach(table => {
            table.columns.forEach(col => {
                if (col.isNullable) {
                    nullableCount++;
                } else {
                    notNullCount++;
                }
            });
        });

        const total = nullableCount + notNullCount;
        const nullablePercentage = ((nullableCount / total) * 100).toFixed(1);
        const notNullPercentage = ((notNullCount / total) * 100).toFixed(1);

        console.log(`  NULL 허용    : ${nullableCount} (${nullablePercentage}%)`);
        console.log(`  NULL 불허    : ${notNullCount} (${notNullPercentage}%)`);
        console.log();
    }

    /**
     * 테이블 관계 분석
     */
    analyzeRelationships() {
        console.log('🔗 테이블 관계 (Foreign Keys)\n');

        // 관계 맵핑
        const relationships = {};

        this.schema.foreignKeys.forEach(fk => {
            if (!relationships[fk.tableName]) {
                relationships[fk.tableName] = [];
            }
            relationships[fk.tableName].push({
                from: fk.columnName,
                to: `${fk.referencedTable}.${fk.referencedColumn}`
            });
        });

        Object.entries(relationships).forEach(([table, rels]) => {
            console.log(`  ${table}:`);
            rels.forEach(rel => {
                console.log(`    ↳ ${rel.from} → ${rel.to}`);
            });
        });

        console.log();
    }

    /**
     * 인덱스 커버리지 분석
     */
    analyzeIndexCoverage() {
        console.log('🔍 인덱스 커버리지\n');

        // 테이블별 인덱스 계산
        const indexedTables = new Set();
        this.schema.indexes.forEach(idx => {
            indexedTables.add(idx.tableName);
        });

        const coverage = (indexedTables.size / this.schema.tables.length * 100).toFixed(1);
        console.log(`  인덱스된 테이블 : ${indexedTables.size}/${this.schema.tables.length} (${coverage}%)`);
        console.log(`  총 인덱스 수    : ${this.schema.indexes.length}`);

        // 인덱스 없는 테이블
        const noIndexTables = this.schema.tables
            .filter(t => !indexedTables.has(t.name))
            .map(t => t.name);

        if (noIndexTables.length > 0) {
            console.log(`\n  ⚠️  인덱스 없는 테이블:`);
            noIndexTables.forEach(t => console.log(`    - ${t}`));
        }

        console.log();
    }

    /**
     * 메트릭 반환
     */
    getMetrics() {
        return {
            totalTables: this.schema.tables.length,
            totalColumns: this.getTotalColumns(),
            totalIndexes: this.schema.indexes.length,
            totalForeignKeys: this.schema.foreignKeys.length,
            totalConstraints: this.schema.constraints.length
        };
    }

    /**
     * 경고사항 반환
     */
    getWarnings() {
        const warnings = [];

        // PK 없는 테이블
        const noPKTables = this.schema.tables.filter(t => !t.primaryKey);
        if (noPKTables.length > 0) {
            warnings.push(`⚠️  Primary Key 없는 테이블: ${noPKTables.map(t => t.name).join(', ')}`);
        }

        // 인덱스 없는 큰 테이블
        const largeNoIndexTables = this.schema.tables.filter(t =>
            t.columns.length > 10 && !this.schema.indexes.some(i => i.tableName === t.name)
        );
        if (largeNoIndexTables.length > 0) {
            warnings.push(`⚠️  인덱스 없는 큰 테이블: ${largeNoIndexTables.map(t => t.name).join(', ')}`);
        }

        return warnings;
    }

    /**
     * 전체 컬럼 수
     */
    getTotalColumns() {
        return this.schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
    }
}

// ============================================================================
// 3. 스키마 비교 클래스
// ============================================================================

class SchemaComparator {
    constructor(schema1Path, schema2Path) {
        this.schema1 = JSON.parse(fs.readFileSync(schema1Path, 'utf8'));
        this.schema2 = JSON.parse(fs.readFileSync(schema2Path, 'utf8'));
        this.differences = {
            addedTables: [],
            removedTables: [],
            modifiedTables: [],
            addedColumns: [],
            removedColumns: [],
            modifiedColumns: []
        };
    }

    /**
     * 스키마 비교
     */
    compare() {
        console.log('\n' + '='.repeat(70));
        console.log('🔄 스키마 비교');
        console.log('='.repeat(70) + '\n');

        this.compareTables();
        this.compareColumns();

        this.printResults();
        return this.differences;
    }

    /**
     * 테이블 비교
     */
    compareTables() {
        const tables1 = new Map(this.schema1.tables.map(t => [t.name, t]));
        const tables2 = new Map(this.schema2.tables.map(t => [t.name, t]));

        // 추가된 테이블
        tables2.forEach((table, name) => {
            if (!tables1.has(name)) {
                this.differences.addedTables.push(name);
            }
        });

        // 제거된 테이블
        tables1.forEach((table, name) => {
            if (!tables2.has(name)) {
                this.differences.removedTables.push(name);
            }
        });

        // 수정된 테이블
        tables1.forEach((table, name) => {
            const table2 = tables2.get(name);
            if (table2 && table.columns.length !== table2.columns.length) {
                this.differences.modifiedTables.push(name);
            }
        });
    }

    /**
     * 컬럼 비교
     */
    compareColumns() {
        this.schema1.tables.forEach(table1 => {
            const table2 = this.schema2.tables.find(t => t.name === table1.name);
            if (!table2) return;

            const cols1 = new Map(table1.columns.map(c => [c.name, c]));
            const cols2 = new Map(table2.columns.map(c => [c.name, c]));

            // 추가된 컬럼
            cols2.forEach((col, name) => {
                if (!cols1.has(name)) {
                    this.differences.addedColumns.push(`${table1.name}.${name}`);
                }
            });

            // 제거된 컬럼
            cols1.forEach((col, name) => {
                if (!cols2.has(name)) {
                    this.differences.removedColumns.push(`${table1.name}.${name}`);
                }
            });

            // 수정된 컬럼
            cols1.forEach((col, name) => {
                const col2 = cols2.get(name);
                if (col2 && col.dataType !== col2.dataType) {
                    this.differences.modifiedColumns.push(`${table1.name}.${name} (${col.dataType} → ${col2.dataType})`);
                }
            });
        });
    }

    /**
     * 결과 출력
     */
    printResults() {
        console.log('📊 변경 사항:\n');

        if (this.differences.addedTables.length > 0) {
            console.log('✅ 추가된 테이블:');
            this.differences.addedTables.forEach(t => console.log(`   + ${t}`));
            console.log();
        }

        if (this.differences.removedTables.length > 0) {
            console.log('❌ 제거된 테이블:');
            this.differences.removedTables.forEach(t => console.log(`   - ${t}`));
            console.log();
        }

        if (this.differences.modifiedTables.length > 0) {
            console.log('⚠️  수정된 테이블:');
            this.differences.modifiedTables.forEach(t => console.log(`   ~ ${t}`));
            console.log();
        }

        if (this.differences.addedColumns.length > 0) {
            console.log('✅ 추가된 컬럼:');
            this.differences.addedColumns.forEach(c => console.log(`   + ${c}`));
            console.log();
        }

        if (this.differences.removedColumns.length > 0) {
            console.log('❌ 제거된 컬럼:');
            this.differences.removedColumns.forEach(c => console.log(`   - ${c}`));
            console.log();
        }

        if (this.differences.modifiedColumns.length > 0) {
            console.log('⚠️  수정된 컬럼:');
            this.differences.modifiedColumns.forEach(c => console.log(`   ~ ${c}`));
            console.log();
        }

        console.log('='.repeat(70) + '\n');
    }
}

// ============================================================================
// 4. 사용 예제
// ============================================================================

// 검증
const validator = new SchemaValidator('./db-schema.json');
validator.validate();

// 분석
const analyzer = new SchemaAnalyzer('./db-schema.json');
analyzer.analyze();

// 비교 (두 개의 스키마 파일)
// const comparator = new SchemaComparator('./db-schema-old.json', './db-schema-new.json');
// comparator.compare();

module.exports = {
    SchemaValidator,
    SchemaAnalyzer,
    SchemaComparator
};