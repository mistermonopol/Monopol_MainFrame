package de.monopol.everything
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate
class StepHistoryTest {
    @Test fun measuredZeroIsNotMissingEvenOnDstDay() {
        val today=LocalDate.parse("2026-10-25")
        val result=aggregateSteps(listOf(StepSample(today,0),StepSample(today.minusDays(1),null)),StepPeriod.DAILY,today)
        assertEquals(0L,result.last().steps);assertNull(result[result.lastIndex-1].steps);assertEquals(1,result.last().expected)
    }
    @Test fun mondayWeeksDeduplicateAndExcludeFuture() {
        val today=LocalDate.parse("2026-11-01");val monday=LocalDate.parse("2026-10-26")
        val result=aggregateSteps(listOf(StepSample(monday,100),StepSample(monday,150),StepSample(today,200),StepSample(today.plusDays(1),900)),StepPeriod.WEEKLY,today).last()
        assertEquals(monday,result.start);assertEquals(350L,result.steps);assertEquals(2,result.recorded);assertEquals(7,result.expected)
    }
    @Test fun monthAndYearBoundariesUseElapsedCalendarDays() {
        val today=LocalDate.parse("2026-01-02")
        val result=aggregateSteps(listOf(StepSample(LocalDate.parse("2025-12-31"),20),StepSample(today.minusDays(1),30)),StepPeriod.MONTHLY,today)
        assertEquals(30L,result.last().steps);assertEquals(2,result.last().expected);assertEquals(31,result[result.lastIndex-1].expected)
    }
    @Test fun bothTranslations() {
        assertEquals("Settings",Localizer.text("Einstellungen","en"));assertEquals("Einstellungen",Localizer.text("Settings","de"));assertEquals("Unverändert",Localizer.text("Unverändert","de"))
    }
}
